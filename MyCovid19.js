/* Magic Mirror
 * Module: MMM-BMW-DS
 * By Mykle1
 * MIT Licensed
 */

Module.register("MyCovid19", {

  // Module config defaults.
  defaults: {
    apiKey: "", // Get FREE API key from darksky.net
    countries: [],
    line_colors:['red','blue','green','yellow','white'],
    maxWidth: 800,
    width: 500,
    height: 500,
    updateInterval: 5,
    dayrange: 7,
    pinLimits: [0,1800],
    skipInfo: 5,
		display_colors: ['#2196f3','#ff0000'],
    debug:false,
    stacked:false,
    labels:['days'],
    YaxisLabel:"Count",
    chart_type:"cumulative_cases",
    backgroundColor: 'black',

  },
  ourID: null, 
  ticklabel:null,
  startLabel: ["1/1/2020", "2/1/2020", "3/1/2020"],
  url: "",
  loaded: false,
  our_data: null,
  wrapper: null,
  suspended: false,
  charts: [null, null],
  pointColors: [],

  getScripts: function () {
    return ["moment.js", "modules/" + this.name + "/node_modules/chart.js/dist/Chart.min.js"];
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    var self = this;
    self.ourID = self.identifier+"_"+Math.floor(Math.random() * 1000) + 1;
    //  Set locale.
    moment.locale(config.language);
    if(this.config.debug) console.log("config =" + JSON.stringify(this.config));
    this.config.countrylist=this.config.countries.slice()    
    for(var i in this.config.countries){
      switch(this.config.countries[i].toLowerCase()) {
        case 'us':
        case 'usa':
        case 'united states':
          // code block
          self.config.countries[i]='United_States_of_America'
          break;
        case "uk":
          self.config.countries[i]="United Kingdom" 
        default:
           self.config.countries[i]= self.config.countries[i].replace(" ","_")
          // code block
      }
    }
    this.sendSocketNotification("CONFIG", {id:self.ourID,config:self.config});

    var next_time=moment().endOf('day').add(2,'hours')
   // if(self.config.debug)
      console.log("timeout diff ="+ next_time.diff(moment()))
    setTimeout(self.refreshData, next_time.diff(moment()));

  },
  refreshData: function(){
    var next_time=moment().endOf('day').add(2,'hours')
    setTimeout(self.refreshData, next_time.diff(moment()));
    self.sendSocketNotification("REFRESH", {id:self.identifier,config:self.config});
  },
  suspend: function () {
    this.suspended = true;
    //self.sendSocketNotification("SUSPEND", null);
  },
  resume: function () {
    this.suspended = false;
    //self.sendSocketNotification("RESUME", null);
    this.updateDom(this.config.initialLoadDelay);
  },

  getDom: function () {
    var self = this
    // if the MM wrapper hasn't been created
    if (self.wrapper == null) {
      self.wrapper = document.createElement("div");
      self.wrapper.className = "wrapper";
      // if the charts will be side by side
      //if (!//this.config.stacked){
        // set the width
        self.wrapper.style.maxWidth = self.config.maxWidth+"px";
        self.wrapper.style.width = self.config.width + "px";
        self.wrapper.style.height = (parseInt(self.config.height) + 20) + "px";        
      //}
    }
    // if we are not suspended/hidden due to sleep or whatever
    if (self.suspended == false) {
      // make sure we don't start before the our_data gets here
      if (!this.loaded) {
        this.loaded = true;
        if(!this.our_data)
         return self.wrapper;
      }

      // loop thru the our_data from the server
      for (var country_index in self.config.countries) {
        // get the country text name. used for index into the our_data hash
        var this_country = self.config.countries[country_index];
        if(this.config.debug)         
          Log.log("cumulative_cases="+JSON.stringify(self.our_data[this_country][self.config.chart_type]))
        // clear the work variable
        var canvas = null;
        // try to locate the existing chart
        if ((canvas = document.getElementById("myChart"+self.ourID )) == null) {
          var c = document.createElement("div");
          c.style.width = self.config.width + "px";
          c.style.height = self.config.height + "px";
          if (!self.config.stacked)
            c.style.display = 'inline-block';
          self.wrapper.appendChild(c);

          canvas = document.createElement("canvas");
          canvas.id = "myChart" +self.ourID ;
          canvas.style.width = (self.config.width -10) + "px";
          canvas.style.height = self.config.height + "px";    
          canvas.style.backgroundColor=self.config.backgroundColor;
          c.appendChild(canvas);
        }
        // if the chart has been created
        if (self.charts[country_index] != null) {
            // destroy it, update doesn't work reliably
            self.charts[country_index].destroy();
            // make it unreferenced
            self.charts[country_index] = null;
            var div = canvas.parentElement;
            div.removeChild(canvas)
            canvas = document.createElement("canvas");
            canvas.id = "myChart" +self.ourID ;
            canvas.style.width = (self.config.width -10) + "px";
            canvas.style.height = self.config.height + "px";    
            canvas.style.backgroundColor=self.config.backgroundColor;
            div.appendChild(canvas);
        }
        var ds = []
        for(var x in self.config.countries){
          if(self.our_data[self.config.countries[x]] != undefined){
            ds.push({
                   xAxisID: 'dates',
                   data: self.our_data[self.config.countries[x]][self.config.chart_type],
                   fill: false,
                   borderColor: self.config.line_colors[x], // Add custom color border (Line)
                   label: self.config.countrylist[x],
                   showInLegend: true, 
                   //backgroundColor:self.our_data[this_country].gradient //self.pointColors[country_index]  //'#2196f3',
            })
          }  
        }
                // create it now
        self.charts[country_index] = new Chart(canvas, {
            type: 'line',
            showLine: true,

            data: {
              datasets: ds
            },
            options: {
              title:{
                display: true, 
                text: self.config.chart_title,   
              },              
              legend: {
                display: true,
                position:'bottom',    
                textAlign: 'right',    
              },
              tooltips: {
                enabled: true,
                displayColors: true,
                position: 'nearest',
                intersect: false,
              },
              responsive: false,
              elements: {
                point: {
                  radius: 0
                },
                line: {
                  tension: 0, // disables bezier curves
                }
              },
              scales: {
                xAxes: [{
                    id: 'dates',
                    type: 'time',
                    distribution: 'linear',
                    scaleLabel: {
                      display: true,
                      labelString: "by date",
                      fontColor: 'white'
                    }, 
                    gridLines: {
                      display: false,
                      zeroLineColor: '#ffcc33'
                    },
                    time: {
                      unit: 'day',
                      parser: 'MM/DD/YYYY'
                    },
                    ticks: {
                      display: true,
                      maxRotation:90,
                      labels: self.ticklabel,
                      source: 'labels',
                      maxTicksLimit: 10, //self.our_data[this_country].length,
                      autoSkip: true,
                    },
                  }
                ],
                yAxes: [
                  {
                    display: true,
                    scaleLabel: {
                      display: true,
                      labelString: self.config.YaxisLabel,
                      fontColor: 'white'
                    },
                    gridLines: {
                      display: false,
                      color: "#FFFFFF",
                      zeroLineColor: '#ffcc33',
                      fontColor: 'white',
                      scaleFontColor: 'white',
                    },

                    ticks: {
                      beginAtZero: true,
                      source: 'data',
                      min: self.config.ranges.min,
                      suggestedMax: self.config.ranges.max,
                      stepSize: self.config.ranges.stepSize,
                      fontColor: 'white'
                    },
                  },
                 /* {
                    display: true,
                    position: 'right',   
                    ticks: {
                      beginAtZero: true,
                      source: 'data',
                      min: self.config.ranges.min,
                      suggestedMax: self.config.ranges.max,
                      stepSize: self.config.ranges.stepSize,
                      fontColor: 'white'
                    },
                    gridLines: {
                        display: false,
                        drawTicks: false
                    }
                  } */
                ]
              },
            }
          }
        );
        break;
      }      
    }
    return self.wrapper;
  },

  notificationReceived: function (notification, payload) {},

  socketNotificationReceived: function (notification, payload) {
    var self = this
    if (notification === 'Data') {
      if(payload.id == self.ourID){
        if(this.config.debug) Log.log("our_data from helper=" + JSON.stringify(payload));
        this.our_data = payload.data
        var keys=Object.keys(this.our_data);
        var last_item=this.our_data[keys[0]];
        var last_date=last_item['cases'][last_item['cases'].length-1].x;
        const myMoment = moment(last_date, 'MM/DD/YYY')
        this.ticklabel=this.startLabel.slice()
        for(var i=myMoment.month()+1; i>3; i++){
           this.ticklabel.push(i+"/1/2020")
        }
        if(last_date != (myMoment.month()+1)+'/1/2020')
          this.ticklabel.push(last_date)
        if(!self.suspended)
          self.updateDom(this.config.initialLoadDelay);
      }
    }
  },

});