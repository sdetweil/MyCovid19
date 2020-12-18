/* Magic Mirror
 * Module: MyCovid19
 * By sdetweil@gmail.com
 * MIT Licensed
 * present COVID 19 virus info in line chart mode
 */

Module.register("MyCovid19", {
	// Module config defaults.
	defaults: {
		type: null,
		states: [],
		countries: [],
		line_colors: ["red", "blue", "green", "yellow", "white"],
		maxWidth: 800,
		width: 500,
		height: 500,
		debug: false,
		newCanvas: false,
		dataGood: false,
		chart_type: "cumulative_cases",
		newFileAvailableTimeofDay: { countries: 2, states: 8, counties: 8 },
		usePreviousFile: true,
		chart_title: "",
		xAxisLabel: "by date",
		yAxisLabel: "Count",

		// colors
		backgroundColor: "black",
		chartTitleColor: "white",
		legendTextColor: "white",

		xAxisLabelColor: "white",
		xAxisTickLabelColor: "white",

		yAxisLabelColor: "white",
		yAxisTickLabelColor: "white",

		attribution_label: {
			countries: "European Centre for Disease Prevention and Control",
			states: "NY Times",
			counties: "NY Times",
		},
		attribution_label_height: 10,
		newWrapper: false,
		defer: true,
	},
	ourID: null,
	loaded: false,
	our_data: null,
	wrapper: null,
	suspended: false,
	charts: {},
	retryDelay: 15,
	timeout_handle: null,
	displayedOnce: false,
	//useYesterdaysData:false,
	//waitingforTodaysData:false,
	initialLoadDelay: 2000,
	tickLabel: [],
	test: 0,
	started: false,

	getScripts: function () {
		return [
			"moment.js",
			"modules/" + this.name + "/node_modules/chart.js/dist/Chart.min.js",
		];
	},

	start: function () {
		started: true, Log.info("Starting module for: " + this.name);
		var self = this;
		self.config.path = this.data.path;
		//Log.log("added path="+this.data.path+" to config data")
		self.ourID =
			self.identifier + "_" + Math.floor(Math.random() * 1000) + 1;
		//  Set locale.
		moment.locale(config.language);
		if (this.config.debug1)
			Log.log("config =" + JSON.stringify(this.config));
		if (
			Array.isArray(this.config.countries) &&
			this.config.countries.length > 0
		)
			this.config.type = "countries";
		else if (
			Array.isArray(this.config.states) &&
			this.config.states.length > 0
		)
			this.config.type = "states";
		else if (
			Array.isArray(this.config.counties) &&
			this.config.counties.length > 0
		)
			this.config.type = "counties";
		else Log.error(this.name + " missing array for countries or states");
		if (self.config.type) {
			this.config.countrylist = this.config[self.config.type].slice();
			if (self.config.type == "countries") {
				for (var i in this.config.countries) {
					switch (this.config.countries[i].toLowerCase()) {
						case "us":
						case "usa":
						case "united states":
							// code block
							self.config.countries[i] =
								"United States";
							break;
						case "uk":
							self.config.countries[i] = "United Kingdom";
						default:
							self.config.countries[i] = self.config.countries[
								i
							].replace(" ", "_");
						// code block
					}
				}
			}
			// tell helper about config
			self.sendSocketNotification("CONFIG", {
				id: self.ourID,
				config: self.config,
			});
		}
	},
	setTimerForNextRefresh(self, offset, type) {
		var next_time = 0;
		if (type == "hours") {
			next_time = moment().endOf("day").add(offset, type);
			self.config.usePreviousFile = true;
		} else {
			next_time = moment().add(offset, type);
			self.config.usePreviousFile = false;
		}
		// if(self.config.debug)
		var millis = next_time.diff(moment());
		if (self.config.debug) Log.log("timeout diff =" + millis);
		if (self.timeout_handle) {
			if (self.config.debug) Log.log("clearing timer");
			clearTimeout(self.timeout_handle);
		}
		if (self.config.debug) Log.log("starting timer");
		self.timeout_handle = setTimeout(() => {
			self.refreshData(self);
		}, millis); // next_time.diff(moment()));
		if (self.config.debug) Log.log("timer started");
	},
	refreshData: function (self) {
		if (self.config.debug) Log.log("refreshing");
		self.sendSocketNotification("REFRESH", {
			id: self.ourID,
			config: self.config,
		});
	},

	suspend: function () {
		if (this.config.debug) Log.log("suspending for id=" + this.ourID);
		this.suspended = true;
		//self.sendSocketNotification("SUSPEND", null);
	},
	resume: function () {
		if (this.config.debug) Log.log("resuming for id=" + this.ourID);
		this.suspended = false;
		//self.sendSocketNotification("RESUME", null);
		if (this.config.dataGood) this.updateDom(this.config.initialLoadDelay);
		else {
			if (this.config.debug) Log.log("data not good, refreshing");
			this.refreshData(this);
		}
	},

	getDom: function () {
		var self = this;
		if (this.config.debug) Log.log("entering getDom() id=" + this.ourID);
		// if the MM wrapper hasn't been created
		if (self.wrapper == null || self.config.newWrapper == true) {
			self.wrapper = document.createElement("div");
			self.wrapper.id = "MyCovid_wrapper_" + self.ourID;
			// if the charts will be side by side
			//if (!//this.config.stacked){
			// set the width
			self.wrapper.style.maxWidth = self.config.width + "px";
			self.wrapper.style.maxHeight = self.config.height + "px";
			self.wrapper.style.width = self.config.width + "px";
			self.wrapper.style.height = parseInt(self.config.height) + "px";
			//}
		}
		// if we are not suspended/hidden due to sleep or whatever
		if (self.suspended == false) {
			// make sure we don't start before the our_data gets here
			if (!this.loaded) {
				this.loaded = true;
				if (!this.our_data) {
					self.wrapper.innerText =
						this.name +
						' Loading data for chart "' +
						self.config.chart_type +
						'"';
					if (this.config.debug)
						Log.log("exiting  getDom() no data id=" + this.ourID);
					return self.wrapper;
				}
			}

			self.displayedOnce = true;
			//self.config.useYesterdaysData=false;
			// loop thru the our_data from the server
			for (var country_index in self.config[self.config.type]) {
				// get the country text name. used for index into the our_data hash
				var this_country = self.config[self.config.type][country_index];
				if (this.config.debug1)
					Log.log(
						self.config.chart_type +
							"=" +
							JSON.stringify(
								self.our_data[this_country][
									self.config.chart_type
								]
							)
					);
				// clear the work variable
				var canvas = null;
				// try to locate the existing chart
				var c = null;
				if (
					(canvas = document.getElementById(
						"myChart_" + self.ourID
					)) != null
				) {
					if (self.config.debug)
						Log.log("removing existing canvas id=" + this.ourID);
					c = canvas.parentElement;
					self.charts[self.ourID].destroy();
					c.removeChild(canvas);
					self.wrapper.removeChild(c);
				}
				if (
					(canvas = document.getElementById(
						"myChart_" + self.ourID
					)) == null
				) {
					self.wrapper.innerText = null;
					if (self.config.debug) Log.log("did not find old canvas");
					c = document.createElement("div");
					c.style.width = self.config.width + "px";
					c.style.height = self.config.height + "px";
					c.style.maxWidth = self.config.width - 10 + "px";
					c.style.maxHeight = self.config.height + "px";
					c.id = "mycovid-container_" + self.ourID;
					self.wrapper.appendChild(c);

					canvas = document.createElement("canvas");
					canvas.id = "myChart_" + self.ourID;
					canvas.style.width = self.config.width - 10 + "px";
					canvas.style.height =
						self.config.height -
						self.config.attribution_label_height +
						"px";
					canvas.style.maxWidth = self.config.width - 10 + "px";
					canvas.style.maxHeight =
						self.config.height -
						self.config.attribution_label_height +
						"px";
					canvas.width = self.config.width - 10;
					canvas.height = self.config.height;
					canvas.style.resize = "none";
					canvas.style.overflow = "hidden";
					canvas.style.backgroundColor = self.config.backgroundColor;
					c.appendChild(canvas);
				}
				// if the chart has been created
				if (self.charts[self.ourID] != null) {
					// destroy it, update doesn't work reliably
					self.charts[self.ourID].destroy();
					// make it unreferenced
					self.charts[self.ourID] = null;
					var div = canvas.parentElement;
					div.removeChild(canvas);
					canvas = document.createElement("canvas");
					canvas.id = "myChart_" + self.ourID;
					canvas.style.width = self.config.width - 10 + "px";
					canvas.style.height =
						self.config.height -
						self.config.attribution_label_height +
						"px";
					canvas.style.maxWidth = self.config.width - 10 + "px";
					canvas.style.maxHeight =
						self.config.height -
						self.config.attribution_label_height +
						"px";
					canvas.style.resize - "none";
					canvas.style.overflow = "hidden";
					canvas.style.backgroundColor = self.config.backgroundColor;
					div.appendChild(canvas);
				}

				// make a hash to avoid collisions
				var __$ds = {};
				// has by our instance ID, which has a random number included
				if (__$ds[this.ourID] == undefined) __$ds[this.ourID] = {};
				// either states or countries
				__$ds[this.ourID][self.config.type] = [];

				// loop thru the configured location (state or country)
				// each instance (this/self) is ONE report of multiple lines of the same location type and data type, cases or deaths
				let labels = [];
				let locations = [];
				if (self.config.type == "counties") {
					for (u of self.config.countrylist)
						labels.push(Object.keys(u)[0]);
					for (l of self.config[self.config.type])
						locations.push(Object.keys(l)[0]);
				} else {
					labels = self.config.countrylist;
					locations = self.config[self.config.type];
				}
				for (var x in self.config[self.config.type]) {
					var location = locations[x];
					// make sure there is data for this selection (spelling errors etc)
					if (self.our_data[location] != undefined) {
						// create a new dataset description, one for each location
						// multiple states or countries
						__$ds[this.ourID][self.config.type].push({
							xAxisID: "dates",
							data:
								self.our_data[location][self.config.chart_type], // < -----   data for this dataset
							fill: false,
							borderColor: self.config.line_colors[x]
								? self.config.line_colors[x]
								: "pink", // Add custom color border (Line)
							backgroundColor: self.config.line_colors[x]
								? self.config.line_colors[x]
								: "pink",
							label: labels[x],
							showInLegend: true,
						});
					}
				}
				var info = {
					self: self,
					ourID: self.ourID,
					canvas: canvas,
					country_index: country_index,
					data: __$ds,
				};
				if (!self.config.defer) {
					info.self.drawChart(info.self, info);
				} else {
					if (this.config.debug)
						Log.log(
							"will execute defered drawing id=" + this.ourID
						);
					setTimeout(() => {
						info.self.offlineTimer(info);
					}, 250);
				}

				break;
			}
		}
		if (this.config.debug) Log.log("exiting  getDom() id=" + this.ourID);
		return self.wrapper;
	},

	offlineTimer: (info) => {
		if (
			(canvas = document.getElementById("myChart_" + info.self.ourID)) !=
			null
		) {
			info.self.drawChart(info.self, info);
		} else
			info.self.setTimeout(() => {
				info.self.offlineTimer(info);
			}, 250);
	},

	drawChart: (self, info) => {
		var chartOptions = {
			layout: {
				padding: {
					left: 30,
					right: 0,
					top: 0,
					bottom: 0,
				},
			},

			title: {
				display: true,
				text: self.config.chart_title,
			},
			legend: {
				//  display: true,
				position: "bottom",
				textAlign: "right",
				labels: { boxWidth: 10 },
			},
			tooltips: {
				enabled: true,
				displayColors: true,
				position: "nearest",
				intersect: false,
			},
			responsive: false,
			elements: {
				point: {
					radius: 0,
				},
				line: {
					tension: 0, // disables bezier curves
				},
			},
			scales: {
				xAxes: [
					{
						id: "dates",
						type: "time",
						distribution: "linear",
						scaleLabel: {
							display: true,
							labelString: self.config.xAxisLabel,
						},
						gridLines: {
							display: false,
							zeroLineColor: "#ffcc33",
						},
						time: {
							unit: "day",
							parser: "MM/DD/YYYY",
						},
						ticks: {
							display: true,
							maxRotation: 90,
							minRotation: 90,
							source: "auto",
							maxTicksLimit: self.ticklabel.length * 2 + 4, //10,
							autoSkip: true,
						},
					},
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
						},

						ticks: {
							beginAtZero: true,
							source: "data",
							min: self.config.ranges.min,
							suggestedMax: self.config.ranges.max,
							stepSize: self.config.ranges.stepSize,
						},
					},
				],
			},
		};
		self.updateOptions(self.config, chartOptions);
		// create it now

		if (self.config.debug) {
			Log.log("defered  drawing in  getDom() id=" + info.ourID);
			Log.log(
				"id=" +
					info.ourID +
					" data=" +
					JSON.stringify(info.data[info.ourID][self.config.type])
			);
		}

		self.charts[info.ourID] = new Chart(info.canvas, {
			type: "line",
			showLine: true,
			data: {
				datasets: info.data[info.ourID][self.config.type],
				labels: self.ticklabel,
			},
			options: chartOptions,
		});
		if (info.self.config.debug)
			Log.log("done defered drawing  getDom() id=" + info.ourID);
		var attribution = document.createElement("div");
		attribution.innerText =
			"courtesy " +
			info.self.config.attribution_label[info.self.config.type];
		attribution.style.fontSize = "9px";
		attribution.style.height =
			self.config.attribution_label_height + 2 + "px";
		attribution.style.textAlign = "center";
		attribution.style.verticalAlign = "text-top";
		info.canvas.parentElement.appendChild(attribution);
	},

	notificationReceived: function (notification, payload) {},

	socketNotificationReceived: function (notification, payload) {
		var self = this;
		if (notification === "Data") {
			if (payload.id == self.ourID) {
				self.config.dataGood = false;
				if (payload.config.debug1)
					Log.log("our_data from helper=" + JSON.stringify(payload));
				// get pointer to data from payload
				this.our_data = JSON.parse(JSON.stringify(payload.data));
				// get the list of countries
				var countries = Object.keys(this.our_data);
				//  get the data for the 1st country, all symetrical
				var first_country_data = this.our_data[countries[0]];

				// get the date from the last entry of cases
				var last_date = first_country_data["cases"].slice(-1)[0].x;
				// convert to moment, in mm/dd/yyyy layout
				const lastMoment = moment(last_date, "MM/DD/YYYY");
				// get now as a moment
				const now = moment();
				// if its states, the data date lages 1 day
				if (payload.config.states.length > 0) {
					now.subtract(1, "d");
				}
				// get just the date of now
				const currentMoment_date = now.format("MM/DD/YYYY");

				// if the last data element date matches today, data is current
				if (
					lastMoment.format("MM/DD/YYYY") == currentMoment_date ||
					self.displayedOnce == false
				) {
					// get first tick from the data
					this.ticklabel = [
						first_country_data["cases"].slice(0, 1)[0].x,
					];
					var firstdate = moment(this.ticklabel[0], "MM/DD/YYYY");
					for (
						var i = firstdate.month() + 2;
						i <= lastMoment.month() + 1;
						i++
					) {
						this.ticklabel.push(i + "/1/2020");
					}

					// if the last date in the data isn't a month boundary
					if (last_date != lastMoment.month() + 1 + "/1/2020")
						// add the specific date entry to the list of Label to display
						// the month would have been added by the loop above
						this.ticklabel.push(last_date);

					// if we are no suspended
					if (!self.suspended)
						// call to get mm to ask us for new charts
						self.updateDom(payload.config.initialLoadDelay);
				}
				if (payload.config.debug)
					Log.log(
						"\tcomparing last=" +
							lastMoment.format("MM/DD/YYYY") +
							" with current=" +
							currentMoment_date +
							" id=" +
							this.ourID
					);
				if (lastMoment.format("MM/DD/YYYY") !== currentMoment_date) {
					if (payload.config.debug)
						Log.log(
							"have data last entry does NOT match today " +
								currentMoment_date +
								" id=" +
								this.ourID
						);
					self.setTimerForNextRefresh(
						self,
						self.retryDelay,
						"minutes"
					);
				} else {
					if (payload.config.debug)
						Log.log(
							"have data last entry  DOES match today " +
								currentMoment_date +
								" id=" +
								this.ourID
						);
					self.config.dataGood = true;
					self.setTimerForNextRefresh(
						self,
						payload.config.newFileAvailableTimeofDay[
							payload.config.type
						],
						"hours"
					);
				}
				if (self.config.debug)
					Log.log("done processing for" + " id=" + this.ourID);
			}
		} else if (notification === "NOT_AVAILABLE") {
			if (payload.config.debug)
				Log.log(
					"received no data available for refresh" +
						" id=" +
						this.ourID
				);
			if (self.displayedOnce) {
				self.setTimerForNextRefresh(self, self.retryDelay, "minutes");
			} else {
				self.refreshData(self);
			}
			if (self.config.debug)
				Log.log("done failure processing for" + " id=" + this.ourID);
		}
	},
	updateOptions(config, chartOptions) {
		var defaults = false;
		var defaultFontInfo = {
			//  defaultColor : 'yourColor',
			//  defaultFontColor : 'yourColor',
			//  defaultFontFamily : 'yourFont',
			//  defaultFontSize:14
		};

		if (config.defaultColor) {
			defaultFontInfo.global["defaultColor"] = config.defaultColor;
			defaults = true;
		}
		if (config.defaultFontColor) {
			defaultFontInfo.global["defaultFontColor"] =
				config.defaultFontColor;
			defaults = true;
		}
		if (config.defaultFontName) {
			defaultFontInfo.global["defaultFontFamily"] =
				config.defaultFontName;
			defaults = true;
		}
		if (config.defaultFontSize) {
			defaultFontInfo.global["defaultFontSize"] = config.defaultFontSize;
			defaults = true;
		}
		if (defaults) {
			// chartOptions['defaults']= defaultFontInfo
		}
		// chart title

		if (config.titleFontFamily != undefined)
			chartOptions.title.fontFamily = config.titleFontFamily;
		if (config.titleFontSize != undefined)
			chartOptions.title.fontSize = config.titleFontSize;
		if (config.titleFontStyle != undefined)
			chartOptions.title.fontStyle = config.titleFontStyle;
		if (config.chartTitleColor)
			chartOptions.title.fontColor = config.chartTitleColor;

		// chart legend

		if (config.legendFontFamily != undefined)
			chartOptions.legend.fontFamily = config.legendFontFamily;
		if (config.legendFontSize != undefined)
			chartOptions.legend.fontSize = config.legendFontSize;
		if (config.legendFontStyle != undefined)
			chartOptions.legend.fontStyle = config.legendFontStyle;
		if (config.legendTextColor) {
			var labels = { fontColor: config.legendTextColor };
			chartOptions.legend["labels"] = Object.assign(
				chartOptions.legend["labels"],
				labels
			);
		}

		// xAxes label

		if (config.xAxisLabelColor != undefined)
			chartOptions.scales.xAxes[0].scaleLabel.fontColor =
				config.xAxisLabelColor;
		if (config.xAxisLabelFontFamily != undefined)
			chartOptions.scales.xAxes[0].scaleLabel.fontFamily =
				config.xAxisLabelFontFamily;
		if (config.xAxisLabelFontSize != undefined)
			chartOptions.scales.xAxes[0].scaleLabel.fontSize =
				config.xAxisLabelFontSize;
		if (config.xAxisLabelFontStyle != undefined)
			chartOptions.scales.xAxes[0].scaleLabel.fontStyle =
				config.xAxisLabelFontStyle;

		// xAxes ticks

		if (config.xAxisTickLabelColor != undefined)
			chartOptions.scales.xAxes[0].ticks.fontColor =
				config.xAxisTickLabelColor;
		if (config.xAxisTickLabelFontFamily != undefined)
			chartOptions.scales.xAxes[0].ticks.fontFamily =
				config.xAxisTickLabelFontFamily;
		if (config.xAxisTickLabelFontSize != undefined)
			chartOptions.scales.xAxes[0].ticks.fontSize =
				config.xAxisTickLabelFontSize;
		if (config.xAxisTickLabelFontStyle != undefined)
			chartOptions.scales.xAxes[0].ticks.fontStyle =
				config.xAxisTickLabelFontStyle;

		// yAxes label

		if (config.yAxisLabelColor != undefined)
			chartOptions.scales.yAxes[0].scaleLabel.fontColor =
				config.yAxisLabelColor;
		if (config.yAxisLabelFontFamily != undefined)
			chartOptions.scales.yAxes[0].scaleLabel.fontFamily =
				config.yAxisLabelFontFamily;
		if (config.yAxisLabelFontSize != undefined)
			chartOptions.scales.yAxes[0].scaleLabel.fontSize =
				config.yAxisLabelFontSize;
		if (config.yAxisLabelFontStyle != undefined)
			chartOptions.scales.yAxes[0].scaleLabel.fontStyle =
				config.yAxisLabelFontStyle;

		//yAxes ticks

		if (config.yAxisTickColor != undefined)
			chartOptions.scales.yAxes[0].ticks.fontColor =
				config.yAxisTicklColor;
		if (config.yAxisTickFontFamily != undefined)
			chartOptions.scales.yAxes[0].ticks.fontFamily =
				config.yAxisTickFontFamily;
		if (config.yAxisTickFontSize != undefined)
			chartOptions.scales.yAxes[0].ticks.fontSize =
				config.yAxisTickFontSize;
		if (config.yAxisTickFontStyle != undefined)
			chartOptions.scales.yAxes[0].ticks.fontStyle =
				config.yAxisTickFontStyle;
	},
});
