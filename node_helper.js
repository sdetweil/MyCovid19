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
    countryfields:['date','cases','deaths','countries','geoid'],
    statefields:['date','state','cases','deaths'],
    country_index: 0,
    suspended: false,
    timer: null,
    lastUpdated: 0,
    retryCount: 3,
    statesurl: "https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv",
    countriesurl:"https://opendata.ecdc.europa.eu/covid19/casedistribution/csv",

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
      var xf="rawdata"+"-"+payload.id  
      request(
        {
          url: payload.config.type=='countries'?this.countriesurl:this.statesurl,
          encoding: null,
          //headers: {
          //  'Accept-Encoding': 'gzip'
          //},
          //gzip: true,
          method: 'GET'
        }, (error, response, body) => {
        if (!error){
          //if(payload.config.debug)
          //  console.log("processing response error="+error+" response.code="+response.statusCode+" file="+xf)    
            //console.log("url="+texturl)      
          if(response.statusCode === 200) {
            //if(payload.config.debug)
            //  console.log("have data")
            fs.writeFileSync(xf,body)

            cvt().fromFile(xf)  // input xls
              .then((result) =>{
                  fs.unlink(xf, (error) => {
                    //if(payload.config.debug)
                    //  console.log("erased file ="+xf)
                  })
                  callback(result, payload, null)                  
              }
            )
          }
          else if(response.statusCode > 400 ){
            if(payload.config.debug)
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
    unique: function(list, name, payload) {
      var self=this
      var result = null;
      if(payload.config.debug1)
        console.log("looking for "+name+" in "+JSON.stringify(list))
      list.forEach(function(e) {
        if(e.toLowerCase().indexOf(name.toLowerCase())>=0){               
          result=e;
        }
      });
      
      return result;
    },
    doGetcountries: function (init, payload, data) {
      var self = this
      // if we are not suspended, and the last time we updated was at least the delay time,
      // then update again
     
			var now=moment()
			var elapsed= moment.duration(now.diff(self.lastUpdated,'minutes'))

			//console.log("getcountries elapsed time since last updated="+elapsed+" init="+init);
      if ((self.suspended == false &&  elapsed>= payload.config.updateInterval) || init==true) {
        self.lastUpdated = moment()

        // format data keyed by country name
        var   country= {}
        var   state = {}
        var   fields= []
        var fieldNames=Object.keys(data[0]);

        if(payload.config.type=='countries'){      

          for(var f of this.countryfields){            
            fields.push(this.unique(fieldNames,f, payload))
          }        
        }
        else{
          for(var  f of this.statefields){
            fields.push(this.unique(fieldNames,f, payload))
          }            
        }

        for(var entry of data){
          if(payload.config.type=='countries'){
            let v = entry[fields[3]]            
            if(payload.config.countries.indexOf(v)>=0){
              //console.log(" country geo="+JSON.stringify(entry))
              if(country[v]==undefined){
                country[v]=[]   
              }        
              country[v].push(entry)          
            }
          }
          else{
            let v = entry[fields[1]]
            if(payload.config.states.indexOf(v)>=0){
              //console.log(" country geo="+JSON.stringify(entry))
              if(state[v]==undefined){
                state[v]=[]   
              }        
              state[v].push(entry) 
            }          
          }
        } 

        var results={}
        if(payload.config.type=='countries'){
          // loop thru all the configured countries 
          for(var c of payload.config.countries){    
            if( country[c]!=undefined){      
              var totalc=0; var totald=0;
              var cases=[]; var deaths=[];
              var tcases=[]; var tdeaths=[];

              for(var u of country[c]){
                if(payload.config.debug1)
                 console.log("date="+u[fields[0]]+" cases="+u[fields[1]]+" deaths="+u[fields[2]]+" geoid="+u[fields[4]])
                // filter out before startDate
                if(payload.config.startDate==undefined || !moment(u[fields[0]],'DD/MM/YYYY').isBefore(moment(payload.config.startDate,'MM/DD/YYYY'))){ 
                  if(u[fields[0]].endsWith("20")){
                    cases.push({ x: moment(u[fields[0]],"DD/MM/YYYY").format('MM/DD/YYYY'), y:parseInt(u[fields[1]])})
                    deaths.push({ x: moment(u[fields[0]],"DD/MM/YYYY").format('MM/DD/YYYY'), y:parseInt(u[fields[2]])})
                  }
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

            }
          }
        }
        else{
          // loop thru all the configured countries 
          for(var c of payload.config.states){    
            if( state[c]!=undefined){      
              var totalc=0; var totald=0;
              var cases=[]; var deaths=[];
              var tcases=[]; var tdeaths=[];
              if(payload.config.debug)
                console.log("there are "+state[c].length+" entries for state="+c);
              for(var u of state[c]){
                if(payload.config.debug1)
                 console.log("date="+u[fields[0]]+" cases="+u[fields[3]]+" deaths="+u[fields[4]])
                // filter out before startDate
                if(payload.config.startDate==undefined || !moment(u[fields[0]],'YYYY-MM-DD').isBefore(moment(payload.config.startDate,'MM/DD/YYYY'))){ 
                  if(u[fields[0]].startsWith("20")){
                    tcases.push({ x: moment(u[fields[0]],"YYYY-MM-DD").format('MM/DD/YYYY'), y:parseInt(u[fields[2]])})
                    tdeaths.push({ x: moment(u[fields[0]],"YYYY-MM-DD").format('MM/DD/YYYY'), y:parseInt(u[fields[3]])})
                  }
                }
              }
              // data presented in reverse dsate order, flip them
              //cases=cases.reverse()
              //deaths=deaths.reverse()
              // initialize cumulative counters to 0
              // make a copy
              cases=JSON.parse(JSON.stringify(tcases))
              deaths=JSON.parse(JSON.stringify(tdeaths))
              // loop thru data and create cumulative counters
              for(var i=cases.length-1;i>0 ;i--){
                cases[i].y-=tcases[i-1].y;
                deaths[i].y-=tdeaths[i-1].y
              }

              var d={'cases':cases, 'deaths':deaths,'cumulative_cases':tcases,'cumulative_deaths':tdeaths}
              //if(payload.config.debug)
              //  console.log("data returned ="+JSON.stringify(d))
              // add this country to the results
              results[c]=d
            }
          }      
          //console.log("done with states data="+JSON.stringify(results))  
        }
          // send the data on to the display module
        //if(payload.config.debug) console.log("data="+JSON.stringify(results))
        //if(payload.config.debug) 
       self.sendSocketNotification('Data', {id:payload.id, config:payload.config, data:results})
    }
  },
    getData: function (init, payload) {
      
			var now=moment()
			var elapsed= moment.duration(now.diff(self.lastUpdated,'minutes'))
      //if(payload.config.debug)
			//  console.log("getData  elapsed time since last updated="+elapsed+" init="+init);
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