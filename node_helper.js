/* Magic Mirror
 * Module: MyCovid19
 *
 * Node_helper written by sdetweil@gmail.com
 *  
 */
const NodeHelper = require('node_helper');
const request = require('request');
const path = require('path')
var moment = require('moment');
var cvt=require("xlsx-to-json")
var fs=require('fs')


module.exports = NodeHelper.create({

    country_index: 0,
    suspended: false,
    timer: null,
    lastUpdated: 0,
    retryCount: 3,
    url:"https://www.ecdc.europa.eu/sites/default/files/documents/COVID-19-geographic-disbtribution-worldwide-",

    start: function () {
      console.log("Starting module: " + this.name);
      self = this;
      self.lastUpdated = moment()
    },

    getInitialData: function (url, payload,  callback) {
      var date = new Date();
      if(payload.config.useYesterdaysData){
        date.setDate(date.getDate()-1);
      }
      var today= date.getFullYear()+"-"+("0"+(date.getMonth()+1)).substring(-2)+"-"+date.getDate() + ".xlsx"
      var texturl= url + today
      if(payload.config.debug)
        console.log("fn="+texturl)
      var xf="rawdata"+"-"+payload.id+"_"+today      
      request(
        {
          url: texturl,
          encoding: null,
          headers: {
            'Accept-Encoding': 'gzip'
          },
          gzip: true,
          method: 'GET'
        }, (error, response, body) => {
        if(payload.config.debug)
          console.log("processing response error="+error+" response.code="+response.statusCode+" file="+xf)
        if (!error){
          if(response.statusCode === 200) {
            if(payload.config.debug)
              console.log("have data")
            fs.writeFileSync(xf,body)
            cvt({
                input: xf,  // input xls
                output: null, // output json
                //sheet: "sheet1",  // specific sheetname
                rowsToSkip: 1 // number of rows to skip at the top of the sheet; defaults to 0
              }, function(err, result) {
                if(err) {
                  console.error(err);
                } else {
                  fs.unlink(xf, (error) => {
                    if(!error){
                      callback(result, payload, error)
                    }
                  })
                }
              }
            )
          }
          else if(response.statusCode > 400 ){
            console.log("no file, retry")
            callback(null, payload, response.statusCode)
          }
        } else if (error)
          console.log("===>error=" + JSON.stringify(error));
      }
      );
    },

     doGetcountries: function (init, payload, data) {
      // if we are not suspended, and the last time we updated was at least the delay time,
      // then update again
			var now=moment()
			var elapsed= moment.duration(now.diff(self.lastUpdated,'minutes'))

			//console.log("getcountries elapsed time since last updated="+elapsed+" init="+init);
      if ((self.suspended == false &&  elapsed>= payload.config.updateInterval) || init==true) {
        self.lastUpdated = moment()
        // clear the array of current data
        //console.log("getting recent pin data");
        countries_loaded = [];
        // get all the countries, callback when done

        // format data keyed by country name
        var   country= {}

        for(var entry of data){
            let v = entry["Countries and territories"]
            //console.log(" country geo="+JSON.stringify(entry))
            if(country[v]==undefined)
              country[v]=[]
            country[v].push(entry)
        }
        var results={}
        // loop thru all the configured countries 
        for(var c of payload.config.countries)
        {    
          if( country[c]!=undefined){      
            var totalc=0; var totald=0;
            var cases=[]; var deaths=[];
            var tcases=[]; var tdeaths=[];

            for(var u of country[c]){
               //console.log("date="+u.DateRep+" cases="+u.Cases+" deaths="+u.Deaths+" geoid="+u.GeoId)
               if(u.DateRep.endsWith("20")){
                 cases.push({ x: u.DateRep+"20", y:parseInt(u.Cases)})
                 deaths.push({ x: u.DateRep+"20", y:parseInt(u.Deaths)})
               }
            }
            // data presented in reverse dsate order, flip them
            cases=cases.reverse()
            deaths=deaths.reverse()
            // initialize cumulative counters to 0
            tcases=cases
            tdeaths=deaths
            // loop thru data and create cumulative counters
            for(var i=1 ; i< cases.length; i++){
              tcases[i].y+=tcases[i-1].y;
              tdeaths[i].y+=tdeaths[i-1].y
            }

            var d={'cases':cases, 'deaths':deaths,'cumulative_cases':tcases,'cumulative_deaths':tdeaths}
            //if(payload.config.debug)
            //  console.log("data returned ="+JSON.stringify(d))
            // add this country to the results
            results[c]=d
            // signify the country was counted
            countries_loaded.push(c)
          }
        }
          // send the data on to the display module
        //if(payload.config.debug) console.log("data="+JSON.stringify(results))
        if(payload.config.debug) console.log("sending data back to module="+payload.id)
        self.sendSocketNotification('Data', {id:payload.id, data:results})
      }
    },
    getData: function (init, payload) {
      
			var now=moment()
			var elapsed= moment.duration(now.diff(self.lastUpdated,'minutes'))
      if(payload.config.debug)
			  console.log("getData  elapsed time since last updated="+elapsed+" init="+init);
      if ((elapsed>= payload.config.updateInterval) || init==true) {
   	    self.getInitialData(self.url, payload, function (data, payload, error) {
          if(error){            
            console.log("sending no data available notification")
            self.sendSocketNotification('NOT_AVAILABLE', {id:payload.id, data:null})
          }
          else {
           //if(payload.config.debug) console.log("data data="+JSON.stringify(data))
    	     self.doGetcountries(init, payload, data);
          }
      	});
			}
    },
    //Subclass socketNotificationReceived received.
    socketNotificationReceived: function (notification, payload) {
      if (notification === 'CONFIG') {
        //this.config[payload.id] = payload.data;
        //console.log("config =" + JSON.stringify(payload));
        self.getData(true, payload);
      }
      else if (notification === 'REFRESH') {
         self.getData(true, payload);
      } else if (notification === 'SUSPEND') {
        self.suspended = true;
      } else if (notification === 'RESUME') {
        self.suspended = false;
        //self.getData(false);
      }
    },
  });