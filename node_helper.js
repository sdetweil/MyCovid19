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
//const cvt=require("xlsx-to-json")
const cvt=require('csvtojson')
var fs=require('fs')


module.exports = NodeHelper.create({

    country_index: 0,
    suspended: false,
    timer: null,
    lastUpdated: 0,
    retryCount: 3,
    url:"https://opendata.ecdc.europa.eu/covid19/casedistribution/csv",

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
      //var today= date.getFullYear()+"-"+("0"+(date.getMonth()+1)).substring(-2)+"-"+date.getDate() + ".xlsx"
      var texturl= url 
      if(payload.config.debug)
        console.log("fn="+texturl)
      var xf="rawdata"+"-"+payload.id  
      request(
        {
          url: texturl,
          encoding: null,
          //headers: {
          //  'Accept-Encoding': 'gzip'
          //},
          //gzip: true,
          method: 'GET'
        }, (error, response, body) => {
        if (!error){
          if(payload.config.debug)
            console.log("processing response error="+error+" response.code="+response.statusCode+" file="+xf)          
          if(response.statusCode === 200) {
            if(payload.config.debug)
              console.log("have data")
            fs.writeFileSync(xf,body)

            cvt().fromFile(xf)  // input xls
              .then((result) =>{
                  fs.unlink(xf, (error) => {
                    if(payload.config.debug)
                      console.log("erased file ="+xf)
                  })
                  callback(result, payload, null)                  
              }
            )
          }
          else if(response.statusCode > 400 ){
            console.log("no file, retry")
            callback(null, payload, response.statusCode)
          }
        } else {
          console.log("===>error=" + JSON.stringify(error));
          callback(null, payload, error)
        }
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
            let v = entry["countriesAndTerritories"]
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
               if(u.dateRep.endsWith("20")){
                 cases.push({ x: moment(u.dateRep,"DD/MM/YYYY").format('MM/DD/YYYY'), y:parseInt(u.cases)})
                 deaths.push({ x: moment(u.dateRep,"DD/MM/YYYY").format('MM/DD/YYYY'), y:parseInt(u.deaths)})
               }
            }
            // data presented in reverse dsate order, flip them
            cases=cases.reverse()
            deaths=deaths.reverse()
            // initialize cumulative counters to 0
            // make a copy
            tcases=JSON.parse(JSON.stringify(cases))
            tdeaths=JSON.parse(JSON.stringify(deaths))
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
        self.sendSocketNotification('Data', {id:payload.id, config:payload.config, data:results})
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
            self.sendSocketNotification('NOT_AVAILABLE', {id:payload.id, config:payload.config, data:null})
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