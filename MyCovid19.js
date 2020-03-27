/* Magic Mirror
 * Module: MyCovid19
 * By sdetweil@gmail.com
 * MIT Licensed
 * present COVID 19 virus info in line chart mode
 */

Module.register("MyCovid19", {

  // Module config defaults.
  defaults: {
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
    chart_type:"cumulative_cases",
    backgroundColor: 'black',
    newFileAvailableTimeofDay:2,
    legendTextColor:'white',
    xAxisTickLabelColor:'white',
    yAxisTickLabelColor:'white',
    xAxisLabelColor:'white',
    yAxisLabelColor:'white',
    chartTitleColor: 'white',
    chart_title:'',
    xAxisLabel:"by date",
    yAxisLabel:"Count",
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
  retryDelay: 15,
  timeout_handle:null,
  displayedOnce:false,
  useYesterdaysData:false,  
  waitingforTodaysData:false,

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
    // initialize flag for data recovery
    self.config.useYesterdaysData=false
    self.sendSocketNotification("CONFIG", {id:self.ourID,config:self.config});
    self.setTimerForNextRefresh(self, self.config.newFileAvailableTimeofDay, 'hours');
  
  },
  setTimerForNextRefresh(self, offset, type){
    var next_time=0
    if(type=='hours')
      next_time=moment().endOf('day').add(offset,type)
    else
      next_time=moment().add(offset,type)
   // if(self.config.debug)
    var millis=next_time.diff(moment())
    console.log("timeout diff ="+ millis)
    if(self.timeout_handle){
      Log.log("clearing timer")
      clearTimeout(self.timeout_handle)
    }
    Log.log("starting timer")
    self.timeout_handle=setTimeout(()=>{self.refreshData(self)},millis ); // next_time.diff(moment()));
    Log.log("timer started")
  },
  refreshData: function(self){    
    Log.log("refreshing")
    self.sendSocketNotification("REFRESH", {id:self.ourID,config:self.config});
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
        if(!this.our_data){
          self.wrapper.innerText=this.name+" Loading data for chart \""+self.config.chart_type+"\""
          return self.wrapper;
        } 
      }
      self.wrapper.innerText=null
      self.displayedOnce=true;
      self.config.useYesterdaysData=false;
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
                fontColor: self.config.chartTitleColor,
              },              
              legend: {
                display: true,
                position:'bottom',    
                textAlign: 'right',
                labels: {
                 fontColor: self.config.legendTextColor,
                }
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
                      labelString: self.config.xAxisLabel,
                      fontColor: self.config.xAxisLabelColor,
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
                      fontColor: self.config.xAxisTickLabelColor,                      
                    },
                  }
                ],
                yAxes: [
                  {
                    display: true,
                    scaleLabel: {
                      display: true,
                      labelString: self.config.yAxisLabel,
                      fontColor: self.config.yAxisLabelColor,
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
                      fontColor: self.config.yAxisTickLabelColor
                    },
                  },
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
        const lastMoment = moment(last_date, 'MM/DD/YYYY')
        const now=moment()
        // if the last data element date matches today, data is good
        if(lastMoment == now.format('MM/DD/YYYY') || self.displayedOnce==false){          
          this.ticklabel=this.startLabel.slice()
          for(var i=lastMoment.month()+1; i>3; i++){
             this.ticklabel.push(i+"/1/2020")
          }
          if(last_date != (lastMoment.month()+1)+'/1/2020')
            this.ticklabel.push(last_date)
          if(!self.suspended)
            self.updateDom(this.config.initialLoadDelay);
        }
        if(lastMoment != now.format("MM/DD/YYYY") ){
          self.waitingforTodaysData=true 
          self.setTimerForNextRefresh(self, self.retryDelay, 'minutes');
        }
        else{
          self.waitingforTodaysData=false;
          self.setTimerForNextRefresh(self, self.config.newFileAvailableTimeofDay, 'hours');
        }
      }
    } else if(notification==='NOT_AVAILABLE'){
      if(payload.id == self.ourID){
        Log.log("received no data available for refresh")
        self.waitingforTodaysData=false
        if(self.displayedOnce)
          self.setTimerForNextRefresh(self, self.retryDelay, 'minutes');
        else{
          self.waitingforTodaysData=true          
          self.refreshData(self)
        }
      }
    }
  },

});