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
    suspended: false,
    retryCount: 3,
    statesurl: "https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv",
    countriesurl:"https://opendata.ecdc.europa.eu/covid19/casedistribution/csv",
    waiting:{'countries':[], 'states':[]},

    start: function () {
      console.log("Starting node_helper for module: " + this.name);
      self = this;
    },

    getInitialData: function ( payload) {
      var self=this;
      var promise = new Promise( (resolve,reject) =>{

        var xf=payload.config.path+payload.config.type+"-rawdata"+"-"+moment().format("MM-DD-YYYY")
        if(payload.config.usePreviousFile && fs.existsSync(xf)){
          if(payload.config.debug)
            console.log("requested file exists="+xf+" sending back to "+payload.id)
          // send it back
          cvt().fromFile(xf)  // input xls
           .then((result) =>{
              resolve( {data:result,payload:payload})
              //callback(result, payload, null)                  
            }
          )
        }
        else{
          if(payload.config.debug)
            console.log("requested file does NOT exist "+payload.id)        
          // if we are not waiting
          var found=false;
          for(var p of this.waiting[payload.config.type]){
            if(p.id == payload.id){
              found=true
              break;
            }
          }
          if(found==false){
            if(payload.config.debug)
              console.log("not on the list to be waiting, adding "+payload.id)
            // say we are
            payload.resolve=resolve
            payload.reject=reject
            this.waiting[payload.config.type].push(payload)
          }
          else  {
            // already waiting?
            if(payload.config.debug)
              console.log("already waiting "+payload.id)
          }

          // if we are the first
          if(this.waiting[payload.config.type].length==1){
            if(payload.config.debug)
               console.log("first to be waiting "+payload.id)
            // send request to get file
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
                if(payload.config.debug)
                  console.log("processing response error="+error+" response.code="+response.statusCode+" file="+xf)    
                  //console.log("url="+texturl)      
                if(response.statusCode === 200) {
                  //if(payload.config.debug)
                  //  console.log("have data")
                  fs.writeFile(xf,body, (error)=>{
                    if(!error){
                      cvt().fromFile(xf)  // input xls
                       .then((result) =>{
                          // send the response to all waiters
                          for(var p of self.waiting[payload.config.type]){
                            if(payload.config.debug)
                              console.log("resolving for id="+p.id)
                            p.resolve({data:result, payload:p})                  
                          }
                          // clear the waiting list
                          self.waiting[payload.config.type]=[]
                          // get yesterdays filename
                          var xf1=payload.config.path+payload.config.type+"-rawdata"+"-"+moment().subtract(1,'days').format("MM-DD-YYYY")
                          // if it exists
                          if(fs.existsSync(xf1)){                        
                            // erase it
                            fs.unlink(xf1, (error) => {
                              if(payload.config.debug)
                                console.log("erased old file ="+xf1)
                            })
                          }  
                        }
                      )
                    }
                    else {
                      if(payload.config.debug)
                        console.log("file write error id="+p.id)
                      for(var p of self.waiting[payload.config.type]){
                          if(payload.config.debug)
                           console.log("rejecting file write for id="+p.id) 
                        p.reject({result:null, payload:p, error:error})    
                      }
                      // clear the waiting list
                      self.waiting[payload.config.type]=[]                   
                    }
                  })         
                } 
                else if(response.statusCode > 400 ){
                  if(payload.config.debug)
                    console.log("no file, retry id="+p.id)
                  for(var p of self.waiting[payload.config.type]){
                    if(payload.config.debug)
                      console.log("rejecting no file for id="+p.id)                    
                    p.reject({data:null, payload:p, error:response.statusCode})    
                  }
                  // clear the waiting list
                  self.waiting[payload.config.type]=[]                                        
                }
              } else {
                if(payload.config.debug)
                  console.log("===>error= id="+p.id+" "+ JSON.stringify(error));
                for(var p of self.waiting[payload.config.type]){
                  if(payload.config.debug)
                    console.log("rejecting error for id="+p.id)                  
                  p.reject({data:null, payload:p, error:error})     
                }
                // clear the waiting list
                self.waiting[payload.config.type]=[]                                   
              }
            }
            );  // end request
          } else {
            if(payload.config.debug)
              console.log("not first waiting "+payload.id)
          }
        }
      } 
      )
    return promise
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
    
      if (init==true) {

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
          if(payload.config.countries.length>0){
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
        if(payload.config.countries.length >0){
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
              if(payload.config.debug1)
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
        }
        // send the data on to the display module
       self.sendSocketNotification('Data', {id:payload.id, config:payload.config, data:results})
    }
  },
    getData: function (init, payload) {
      
      if ( init==true) {
   	    self.getInitialData( payload) .then( (output) =>{
                   //if(payload.config.debug) console.log("data data="+JSON.stringify(data))
           self.doGetcountries(init, output.payload, output.data);
          },(error)=>{            
            console.log("sending no data available notification")
            self.sendSocketNotification('NOT_AVAILABLE', {id:error.payload.id, config:error.payload.config, data:null})
          }
      	);
			}
    },
    // socketNotificationReceived received.
    socketNotificationReceived: function (notification, payload) {
      if (notification === 'CONFIG') {
        self.getData(true, payload);
      }
      else if (notification === 'REFRESH') {
         self.getData(true, payload);
      } else if (notification === 'SUSPEND') {
        self.suspended = true;
      } else if (notification === 'RESUME') {
        self.suspended = false;
      }
    },
  });