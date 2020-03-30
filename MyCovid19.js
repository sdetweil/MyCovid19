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
		//display_colors: ['#2196f3','#ff0000'],
    debug:false,
    stacked:false,
    chart_type:"cumulative_cases",
    newFileAvailableTimeofDay:2,

    chart_title:'',
    xAxisLabel:"by date",
    yAxisLabel:"Count",

    // colors
    backgroundColor: 'black',   
    chartTitleColor: 'white',
    legendTextColor:'white',

    xAxisLabelColor:'white',    
    xAxisTickLabelColor:'white',

    yAxisLabelColor:'white',    
    yAxisTickLabelColor:'white',    
    startLabel: ["1/1/2020", "2/1/2020", "3/1/2020"],

  },
  ourID: null, 
  ticklabel:null,
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
  initialLoadDelay: 2000,   
  tickLabel:[],
  test:0,

  getScripts: function () {
    return ["moment.js", "modules/" + this.name + "/node_modules/chart.js/dist/Chart.min.js"];
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    var self = this;
    self.ourID = self.identifier+"_"+Math.floor(Math.random() * 1000) + 1;
    //  Set locale.
    moment.locale(config.language);
    if(this.config.debug) Log.log("config =" + JSON.stringify(this.config));
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
    Log.log("timeout diff ="+ millis)
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
        var chartOptions= {

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
                      labelString: self.config.xAxisLabel,

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
                      //labels: self.ticklabel,
                      source: 'labels',
                      maxTicksLimit: (self.ticklabel.length*2)+3, //10, //self.our_data[this_country].length,
                      autoSkip: true,   
                    },
                  }
                ],
                yAxes: [
                  {
                    display: true,
                    scaleLabel: {
                      display: true,
                      labelString: self.config.yAxisLabel,

                    },
                    gridLines: {
                      display: false,
                     // color: "#FFFFFF",
                     // zeroLineColor: '#ffcc33',
                     // fontColor: 'white',
                     // scaleFontColor: 'white',
                    },

                    ticks: {
                      beginAtZero: true,
                      source: 'data',
                      min: self.config.ranges.min,
                      suggestedMax: self.config.ranges.max,
                      stepSize: self.config.ranges.stepSize,

                    },
                  },
                ]
              },
            }
        self.updateOptions(self.config, chartOptions)
                // create it now
        self.charts[country_index] = new Chart(canvas, {
            type: 'line',
            showLine: true,
            data: {
              datasets: ds,
              labels: self.ticklabel,
            },
            options: chartOptions, 
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
        if(payload.config.debug) Log.log("our_data from helper=" + JSON.stringify(payload));
        // get pointer to data from payload
        this.our_data = payload.data
        // get the list of countries  
        var countries=Object.keys(this.our_data);
        //  get the data for the 1st country, all symetrical
        var first_country_data=this.our_data[countries[0]];
        if(payload.config.debug)
          Log.log("test flag="+self.test)
        if(self.test-- >0){
          Log.log("forcing old date");
          for(var c of countries){
             // for testing,  remove last entry, to force retry
             this.our_data[c]['cases'].splice(-1,1)
             this.our_data[c]['deaths'].splice(-1,1)
             this.our_data[c]['cumulative_cases'].splice(-1,1)
             this.our_data[c]['cumulative_deaths'].splice(-1,1)
          }
        }
        // get the date from the last entry of cases
        var last_date=first_country_data['cases'].slice(-1)[0].x;        
        // convert to moment, in mm/dd/yyyy layout 
        const lastMoment = moment(last_date, 'MM/DD/YYYY')
        // get now as a moment
        const now=moment()
        // get just the date of now
        const currentMoment_date=now.format("MM/DD/YYYY")
        // if the last data element date matches today, data is current        
        if(lastMoment.format('MM/DD/YYYY') == currentMoment_date || self.displayedOnce==false){          

          // get first tick from the data
          this.ticklabel=[first_country_data['cases'].slice(1)[0].x]            
          var  firstdate=moment(this.ticklabel[0],'MM/DD/YYYY')
          for(var i=firstdate.month()+2; i<=lastMoment.month()+1; i++){
            this.ticklabel.push(i+"/1/2020")
          }
          
          // if the last date in the data isn't a month boundary
          if(last_date != (lastMoment.month()+1)+'/1/2020')
            // add the specific date entry to the list of Label to display
            // the month would have been added by the loop above
            this.ticklabel.push(last_date)
          // if we are no suspended  
          if(!self.suspended)
            // call to get mm to ask us for new charts
            self.updateDom(payload.config.initialLoadDelay);
        }
        if(payload.config.debug)
          Log.log("comparing last="+lastMoment.format('MM/DD/YYYY')+" with current="+currentMoment_date)
        if(lastMoment.format('MM/DD/YYYY') !== currentMoment_date ){
          if(payload.config.debug)
            Log.log("have data last entry does NOT match today "+currentMoment_date)
          self.waitingforTodaysData=true 
          self.setTimerForNextRefresh(self, self.retryDelay, 'minutes');
        }
        else{
          if(payload.config.debug)
            Log.log("have data last entry  DOES match today "+currentMoment_date)          
          self.waitingforTodaysData=false;
          self.setTimerForNextRefresh(self, self.config.newFileAvailableTimeofDay, 'hours');
        }
      }
    } else if(notification==='NOT_AVAILABLE'){
      if(payload.id == self.ourID){
        if(payload.config.debug)
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
  updateOptions(config, chartOptions){
    var defaults=false;
        var defaultFontInfo = {      
              global:{
              //  defaultColor : 'yourColor',
              //  defaultFontColor : 'yourColor',
              //  defaultFontFamily : 'yourFont',
              //  defaultFontSize:14
              }                
        }    
// defaults

    if(config.defaultColor){
      defaultFontInfo.global['defaultColor']=config.defaultColor
      defaults=true
    }
    if(config.defaultFontColor){
      defaultFontInfo.global['defaultFontColor']=config.defaultFontColor
      defaults=true
    }    
    if(config.defaultFontName){
      defaultFontInfo.global['defaultFontFamily']=config.defaultFontName
      defaults=true
    }   
    if(config.defaultFontSize){
      defaultFontInfo.global['defaultFontSize']=config.defaultFontSize
      defaults=true
    }   
    if(defaults)    {
      chartOptions['defaults']= defaultFontInfo
    }
// chart title

    if(config.titleFontFamily!=undefined)
      chartOptions.title.fontFamily=config.titleFontFamily
    if(config.titleFontSize!=undefined)
      chartOptions.title.fontSize=config.titleFontSize
    if(config.titleFontStyle!=undefined)
      chartOptions.title.fontStyle=config.titleFontStyle
    if(config.chartTitleColor)
      chartOptions.title.fontColor=config.chartTitleColor

// chart legend

    if(config.legendFontFamily!=undefined)
      chartOptions.legend.fontFamily=config.legendFontFamily
    if(config.legendFontSize!=undefined)
      chartOptions.legend.fontSize=config.legendFontSize
    if(config.legendFontStyle!=undefined)
      chartOptions.legend.fontStyle=config.legendFontStyle
    if(config.legendTextColor){
      var labels = { fontColor: config.legendTextColor}
      chartOptions.legend['labels']= labels
    }

// xAxes label

    if(config.xAxisLabelColor !=undefined)
      chartOptions.scales.xAxes[0].scaleLabel.fontColor=config.xAxisLabelColor
    if(config.xAxisLabelFontFamily!=undefined)
      chartOptions.scales.xAxes[0].scaleLabel.fontFamily= config.xAxisLabelFontFamily
    if(config.xAxisLabelFontSize!=undefined)
      chartOptions.scales.xAxes[0].scaleLabel.fontSize= config.xAxisLabelFontSize
    if(config.xAxisLabelFontStyle!=undefined)
      chartOptions.scales.xAxes[0].scaleLabel.fontStyle= config.xAxisLabelFontStyle    

// xAxes ticks

    if(config.xAxisTickLabelColor!=undefined)
      chartOptions.scales.xAxes[0].ticks.fontColor= config.xAxisTickLabelColor
    if(config.xAxisTickLabelFontFamily!=undefined)
      chartOptions.scales.xAxes[0].ticks.fontFamily= config.xAxisTickLabelFontFamily
    if(config.xAxisTickLabelFontSize!=undefined)
      chartOptions.scales.xAxes[0].ticks.fontSize= config.xAxisTickLabelFontSize
    if(config.xAxisTickLabelFontStyle!=undefined)
      chartOptions.scales.xAxes[0].ticks.fontStyle= config.xAxisTickLabelFontStyle

// yAxes label    

    if(config.yAxisLabelColor !=undefined)
      chartOptions.scales.yAxes[0].scaleLabel.fontColor=config.yAxisLabelColor
    if(config.yAxisLabelFontFamily!=undefined)
      chartOptions.scales.yAxes[0].scaleLabel.fontFamily= config.yAxisLabelFontFamily
    if(config.yAxisLabelFontSize!=undefined)
      chartOptions.scales.yAxes[0].scaleLabel.fontSize= config.yAxisLabelFontSize
    if(config.yAxisLabelFontStyle!=undefined)
      chartOptions.scales.yAxes[0].scaleLabel.fontStyle= config.yAxisLabelFontStyle    

//yAxes ticks

    if(config.yAxisTickColor!=undefined)
      chartOptions.scales.yAxes[0].ticks.fontColor= config.yAxisTicklColor
    if(config.yAxisTickFontFamily!=undefined)
      chartOptions.scales.yAxes[0].ticks.fontFamily= config.yAxisTickFontFamily
    if(config.yAxisTickFontSize!=undefined)
      chartOptions.scales.yAxes[0].ticks.fontSize= config.yAxisTickFontSize
    if(config.yAxisTickFontStyle!=undefined)
      chartOptions.scales.yAxes[0].ticks.fontStyle= config.yAxisTickFontStyle    

  }


});