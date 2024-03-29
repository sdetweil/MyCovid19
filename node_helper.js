/* Magic Mirror
 * Module: MyCovid19
 *
 * Node_helper written by sdetweil@gmail.com
 *
 */
const NodeHelper = require("node_helper");
const request = require("request");
const path = require("path");
const moment = require("moment");
const cvt = require("csvtojson");
const fs = require("fs");
const { exec } = require('child_process');
const tmp = require('tmp');
const os = require("os");



module.exports = NodeHelper.create({

	datafields: {
		countries: {
			// changed starting `12/17/20
		  /*
			date_fieldname: "dateRep",
			cases_fieldname: "cases",
			deaths_fieldname: "deaths",
			location_fieldname: "countriesAndTerritories",
			geo_fieldname: "geoid", */
			date_fieldname: "date",
			cases_fieldname: "total_cases",
			deaths_fieldname: "total_deaths",
			location_fieldname: "location",
			geo_fieldname: "continent"

		},
		states: {
			date_fieldname: "date",
			location_fieldname: "state",
			cases_fieldname: "cases",
			deaths_fieldname: "deaths",
		},
		counties: {
			date_fieldname: "date",
			location_fieldname: "county",
			statename_fieldname: "state",
			cases_fieldname: "cases",
			deaths_fieldname: "deaths",
		},
	},
	suspended: false,
	retryCount: 3,
	active:{countries:0, counties:0, states:0},
	sourceurls: {
		states:
			"https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv",
		countries:
		   "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data.csv",
		  // changed 12/17/2020 .. ecdc source dropped
			//"https://opendata.ecdc.europa.eu/covid19/casedistribution/csv",
		counties:
			"https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv",
	},
	// changed 12/17/2020 .. ecdc source dropped
  data_order: { countries: "forward", states: "forward", counties: "forward" },
	waiting: { countries: [], states: [], counties: [] },
	date_mask: {
	  // changed 12/17/2020 .. ecdc source dropped
		countries: "YYYY-MM-DD", // "DD/MM/YYYY",
		states: "YYYY-MM-DD",
		counties: "YYYY-MM-DD",
	},
	charter_date_format: "MM/DD/YYYY",
	config_date_format: "MM/DD/YYYY",
	downloading:{ countries: false, states: false, counties: false },

	start: function () {
		console.log("Starting node_helper for module: " + this.name);
		self = this;
	},

	waitForFile: function (payload) {
		return new Promise((resolve, reject) => {
			// send it back
			let goodfile= false;
			if (
				payload.config.usePreviousFile == true &&
				fs.existsSync(payload.filename))
				{
					if(!this.downloading[payload.config.type]){
						let stats= fs.statSync(payload.filename)
						if(stats["size"]>3000000) {
							console.log("active type="+payload.config.type)
							if(++this.active[payload.config.type]==1){
								if (payload.config.debug)
									console.log("have data, we are 1st, continue")
								goodfile=true;
							}
							else{
								if (payload.config.debug)
									console.log("have data, we are NOT 1st, will wait")
							}
						}
						else
							// file is damaged, erase
							fs.unlinkSync(payload.filename)
					} else {
						if (payload.config.debug)
									console.log("already downloading, have to wait")
					}
				}
				else{
					if (payload.config.debug)
						console.log("don't use previous file ="+payload.filename+" file does not exist, or get new one, usePreviousFile="+payload.config.usePreviousFile )
					//goodfile=true
				}
			if(goodfile)
				// no need to wait
				resolve(payload);
			else {
				// wait, save our promise notifiy functions
				payload.resolve.unshift(resolve);
				payload.reject.unshift(reject);
			}
		});
	},

	fieldtest: {
		states: (x, payload) => {
			return (
				payload.config[payload.config.type].indexOf(
					x[payload.fields.location_fieldname]
				) >= 0
			);
		},
		countries: (x, payload) => {
			return (
				payload.config[payload.config.type].indexOf(
					x[payload.fields.location_fieldname]
				) >= 0
			);
		},
		counties: (x, payload) => {
			// get the county name from the data
			let county = x[payload.fields.location_fieldname];
			let state = x[payload.fields.statename_fieldname];
			// console.log("looking for county="+county+" and state="+state)
			// loop thru the config to see if its one we care about
			let r = payload.config[payload.config.type].filter((location) => {
				// if this data record  is for the selected county, check its matching state
				return (
					location.hasOwnProperty(county) && location[county] == state
				);
			});
			//console.log(" found it"+JSON.stringify(r))
			return r.length > 0;
		},
	},

	processFileData: async  function (payload) {
		let self = this;
		if (payload.config.debug)
			console.log(
				"processing id=" +
					payload.id +
					" file=" +
					payload.filename +
					" fields=" +
					JSON.stringify(payload.fields)
			);
		// get the start date filter if specified
		if (!payload.config.startDate)
			console.log(" no startDate specified, default 01/01/2020 used");
		let start = payload.config.startDate
			? moment(payload.config.startDate, self.config_date_format)
			: moment("01/01/2020", self.config_date_format);
		if (payload.config.type != "countries")
			start = start.subtract(1, "days");

		var tmpObj={}
		// if we dont have a temp file yet
		if(!payload.tmpfile){
			// get the name
			tmpObj = tmp.fileSync({ mode: 0666,discardDescriptor: true, prefix: payload.config.type, postfix: '.csv' });
			// save it
			payload.tmpfile=tmpObj.name
		}
		let tpath=payload.config.path
		if(os.platform() == "win32" ){
			ext='.cmd'
			tpath=tpath.replace(new RegExp('/', 'g'), '\\')
		}
		else
			ext='.sh'
		let tfn=payload.filename.split('/').slice(-1)
		let temp=''
		switch (payload.config.type) {
			case 'counties':
				temp=JSON.stringify(payload.config[payload.config.type]).slice(1,-1)
			break;
			default:
				temp=payload.config[payload.config.type].join(',')
		}
		// create a filtered csv , reduce 88meg to <100k prevent stack crash
		let cmd_string=tpath+"filtercsv"+ext+" "+payload.config.type+" "+tpath+tfn+" "+payload.tmpfile+" "+temp
		if(payload.config.debug){
			console.log("filtering via "+cmd_string)
		}
		exec(cmd_string, { windowsHide: true},(error, stdout, stderr) => {
			if (error) {
				console.error(`exec error: ${error}`);
				return;
			}

			if (payload.config.debug)
				console.log("calling csvtojson")
			cvt()
				.fromFile(payload.tmpfile) // input xls  // changed to tmpfile
				.subscribe((jsonObj, index) => {
					try {
						// if this field is for one of the locations requested
						if (
							self.fieldtest[payload.config.type](jsonObj, payload)
						) {
							// if this location is within the date range
							if (
								moment(
									jsonObj[payload.fields.date_fieldname],
									self.date_mask[payload.config.type]
								).isSameOrAfter(start)
							) {
								//console.log("saving data for location ="+ jsonObj[payload.fields.location_fieldname])
								payload.location[
									jsonObj[payload.fields.location_fieldname]
								].push(jsonObj);
							}
						}
					} catch (error) {
						console.log(" location undefined =" + error);
					}
				})
				.then((result) => {
					// all done, tell the topmost function we completed
					if (payload.config.debug)
						console.log("done processing file id=" + payload.id);
					// get the 1st promise resolver if any), and send the data back
					if(payload.resolve.length){
						payload.resolve.shift()({
							data: payload.location,
							payload: payload,
						});
					}
				},(error)=>{
					console.log("error on cvt file = "+ payload.filename)
				});
			})
	},

	getInitialData: function (payload) {
		var self = this;
		var promise = new Promise((resolve, reject) => {
			var xf =
				payload.config.path +
				payload.config.type +
				"-rawdata" +
				"-" +
				moment().format("MM-DD-YYYY") +
				".csv";
			let location = {};
			let fields = self.datafields[payload.config.type];
			/*	payload.config.type == "countries"
					? self.countryfields
					: self.statefields; */
			if (payload.config.type != "counties")
				for (let n of payload.config[payload.config.type])
					location[n] = [];
			else
				for (let n of payload.config[payload.config.type])
					location[Object.keys(n)[0]] = [];

			if (payload.config.debug) {
				console.log(
					"requested file exists=" +
						xf +
						" sending back to " +
						payload.id
				);
			}
			payload.location = location;
			payload.filename = xf;
			payload.fields = fields;
			// initialize the promise pointer arrays
			payload.resolve = [];
			payload.reject = [];
			// save our resolve/reject
			payload.resolve.push(resolve);
			payload.reject.push(reject);

			if (payload.config.debug)
				console.log("ready to get data id=" + payload.id);

			self.waitForFile(payload).then((payload) => {
				if (payload.config.debug)
					console.log("getInitialData check for file =" + payload.filename);
				if (fs.existsSync(payload.filename)) {
					self.processFileData(payload);
				} else {
					reject("file not found=" + payload.filename);
				}
				return;
			});
			if (payload.config.debug){
				console.log("waitForFile waiting  usePreviousFile="+payload.config.usePreviousFile)
			}

			self.waiting[payload.config.type].push(payload);
			// if we should NOT reuse the previous file
			// or
			// the file doesn't exist
			if (
				payload.config.usePreviousFile == false ||
				!fs.existsSync(payload.filename)
			) {
				// if we are the first
				if (self.waiting[payload.config.type].length == 1) {
					if (payload.config.debug)
						console.log(
							"first to be waiting " +
								payload.id +
								" url= " +
								self.sourceurls[
									payload.config.type
								]
						);
					self.getFile(payload);
				} else {
					if (payload.config.debug)
						console.log("not first waiting " + payload.id);
				}
			} else {
				if (payload.config.debug)
						console.log("nothing to do but wait " + payload.id);
			}
		});
		return promise;
	},

	getFile: function (payload) {
		var self = this;
		this.downloading[payload.config.type] = true;
		// send request to get file
		request(
			{
				url: self.sourceurls[payload.config.type],
				encoding: null,
				method: "GET",
			},
			(error, response, body) => {
				this.downloading[payload.config.type] = false;
				if (!error) {
					if (payload.config.debug)
						console.log(
							"processing response error=" +
								error +
								" response.code=" +
								response.statusCode +
								" file=" +
								payload.filename
						);
					//console.log("url="+texturl)
					if (response.statusCode === 200) {
						//if(payload.config.debug)
						//  console.log("have data")
						fs.writeFile(payload.filename, body, (error) => {
							if (!error) {
								// send the response to all waiters
								/*for (var p of self.waiting[
									payload.config.type
								]) {
									if (payload.config.debug)
										console.log("resolving for id=" + p.id);
									p.resolve.shift()(p);
								}
								// clear the waiting list
								self.waiting[payload.config.type] = []; */
								// get the 1st element on the waiting stack, for this type
								let p = self.waiting[payload.config.type][0]
								// allow us to keep going
								if (payload.config.debug)
										console.log("getfile resolving for id=" + p.id);
								p.resolve.shift()(p);
								// get yesterdays filename
								var xf1 =
									payload.config.path +
									payload.config.type +
									"-rawdata" +
									"-" +
									moment()
										.subtract(1, "days")
										.format("MM-DD-YYYY") +
									".csv";
								// if it exists
								if (fs.existsSync(xf1)) {
									// erase it
									fs.unlink(xf1, (error) => {
										if (payload.config.debug)
											console.log(
												"erased old file =" + xf1
											);
									});
								}
							} else {
								if (payload.config.debug)
									console.log("file write error id=" + p.id);
								for (var p of self.waiting[
									payload.config.type
								]) {
									if (payload.config.debug)
										console.log(
											"rejecting file write for id=" +
												p.id
										);
									p.reject.shift()({
										result: null,
										payload: p,
										error: error,
									});
								}
								// clear the waiting list
								self.waiting[payload.config.type] = [];
							}
						});
					} else if (response.statusCode > 400) {
						if (payload.config.debug)
							console.log("no file, retry id=" + p.id);
						for (var p of self.waiting[payload.config.type]) {
							if (payload.config.debug)
								console.log("rejecting no file for id=" + p.id);
							p.reject.shift()({
								data: null,
								payload: p,
								error: response.statusCode,
							});
						}
						// clear the waiting list
						self.waiting[payload.config.type] = [];
					}
				} else {
					if (payload.config.debug)
						console.log(
							"===>error= id=" +
								payload.id +
								" " +
								JSON.stringify(error)
						);
					for (var p of self.waiting[payload.config.type]) {
						if (payload.config.debug)
							console.log("rejecting error for id=" + p.id);
						p.reject.shift()({
							data: null,
							payload: p,
							error: error,
						});
					}
					// clear the waiting list
					self.waiting[payload.config.type] = [];
				}
			}
		); // end request
	},

	unique: function (list, name, payload) {
		var self = this;
		var result = null;
		if (payload.config.debug1)
			console.log("looking for " + name + " in " + JSON.stringify(list));
		list.forEach(function (e) {
			if (e.toLowerCase().indexOf(name.toLowerCase()) >= 0) {
				result = e;
			}
		});

		return result;
	},

	checkDate: function (date, payload) {
		// changed 12/17/2020
		if (payload.config.type == "countries1") return parseInt(date.slice(-2)) >=20
		else return date.startsWith("20");
	},

	doGetcountries: function (init, payload, location) {
		var self = this;
		return new Promise((resolve, reject) => {
			//if (init == true) {
			// format data keyed by country name
			let fields = self.datafields[payload.config.type];

			var results = {};
			if (payload.config.debug)
				console.log(
					"processing for " +
						JSON.stringify(payload.config[payload.config.type])
				);
			let start = payload.config.startDate
				? moment(payload.config.startDate, self.config_date_format)
				: moment("01/01/2020");
			for (var c of Object.keys(location)) {
				// payload.config[payload.config.type]) {
				if (location[c] != undefined) {
					if (payload.config.debug) console.log("location=" + c);
					var totalc = 0;
					var totald = 0;
					var cases = [];
					var deaths = [];
					var tcases = [];
					var tdeaths = [];
					if (payload.config.debug)
						console.log(
							"there are " +
								location[c].length +
								" entries to filter"
						);

					for (var u of location[c]) {
						if (payload.config.debug)
							console.log(JSON.stringify(u));
						// filter out before startDate
						if (
							true
						) {
							if (
								self.checkDate(
									u[fields.date_fieldname],
									payload
								)
							) {
								if (payload.config.type == "countries1") {
									cases.push({
										x: moment(
											u[fields.date_fieldname],
											self.date_mask[payload.config.type]
										).format(self.charter_date_format),
										y: parseInt(u[fields.cases_fieldname]),
									});
									deaths.push({
										x: moment(
											u[fields.date_fieldname],
											self.date_mask[payload.config.type]
										).format(self.charter_date_format),
										y: parseInt(u[fields.deaths_fieldname]),
									});
								} else {
									tcases.push({
										x: moment(
											u[fields.date_fieldname],
											self.date_mask[payload.config.type]
										).format(self.charter_date_format),
										y: parseInt(u[fields.cases_fieldname]),
									});
									tdeaths.push({
										x: moment(
											u[fields.date_fieldname],
											self.date_mask[payload.config.type]
										).format(self.charter_date_format),
										y: parseInt(u[fields.deaths_fieldname]),
									});
								}
							}
						}
					}
					// changed 12/17/2020 .. ecdc source dropped
					if (self.data_order[payload.config.type] =='reverse') {
						// data presented in reverse date order, flip them
						cases = cases.reverse();
						deaths = deaths.reverse();
						// initialize cumulative counters to 0
						// make a copy
						tcases = JSON.parse(JSON.stringify(cases));
						tdeaths = JSON.parse(JSON.stringify(deaths));
						// loop thru data and create cumulative counters
						for (var i = 1; i < cases.length; i++) {
							tcases[i].y += tcases[i - 1].y;
							tdeaths[i].y += tdeaths[i - 1].y;
						}
					} else {
						// initialize cumulative counters to 0
						// make a copy
						cases = JSON.parse(JSON.stringify(tcases));
						deaths = JSON.parse(JSON.stringify(tdeaths));
						// loop thru data and create cumulative counters
						for (var i = cases.length - 1; i > 0; i--) {
							cases[i].y -= tcases[i - 1].y;
							deaths[i].y -= tdeaths[i - 1].y;
						}
						cases.splice(0, 1);
						deaths.splice(0, 1);
						tcases.splice(0, 1);
						tdeaths.splice(0, 1);
					}

					var d = {
						cases: cases,
						deaths: deaths,
						cumulative_cases: tcases,
						cumulative_deaths: tdeaths,
					};
					//if(payload.config.debug)
					//  console.log("data returned ="+JSON.stringify(d))
					// add this country to the results
					results[c] = d;
				}
			}
			resolve(results);
		});
	},
	getData: function (init, payload) {
		if (init == true) {
			self.getInitialData(payload).then(
				(output) => {
					if (payload.config.debug)
						console.log("have data, now filter id=" + payload.id);
					// if we are on the waiting listm, remove us
					if(self.waiting[payload.config.type][0].id===payload.id){
						if (payload.config.debug)
							console.log("we were on the waiting list")
						self.waiting[payload.config.type].shift()
						self.active[payload.config.type]--;
						// if there is some other task on the waiting list
						if(self.waiting[payload.config.type].length){
							// wake it up
							let p = self.waiting[payload.config.type][0]
							if(p.config.debug)
								console.log("wake up waiter="+p.id)
							p.resolve.shift()(p)
						}
					}
					self.doGetcountries(init, output.payload, output.data)
						.then((data) => {
							// send the data on to the display module
							if (payload.config.debug)
								console.log(
									"send filtered data id=" + payload.id
								);
							self.sendSocketNotification("Data", {
								id: payload.id,
								config: payload.config,
								data: data,
							});
						})
						.catch((error) => {
							if (payload.config.debug)
								console.log(
									"getData cause error =" + JSON.stringify(error)
								);
							self.sendSocketNotification("NOT_AVAILABLE", {
								id: payload.id,
								config: payload.config,
								data: null,
							});
						});
				},
				(error) => {
					console.log("sending no data available notification error="+JSON.stringify(error));
					self.sendSocketNotification("NOT_AVAILABLE", {
						id: payload.id,
						config: payload.config,
						data: null,
					});
				}
			);
		}
	},
	// socketNotificationReceived received.
	socketNotificationReceived: function (notification, payload) {
		if (notification === "CONFIG") {
			//console.log("payload="+JSON.stringify(payload,null,2))
			self.getData(true, payload);
		} else if (notification === "REFRESH") {
			self.getData(true, payload);
		} else if (notification === "SUSPEND") {
			self.suspended = true;
		} else if (notification === "RESUME") {
			self.suspended = false;
		}
	},
});
