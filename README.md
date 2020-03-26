# MyCovid19

monitor COVID 19 virus stats with line graphs
 


## Dependencies

* An installation of [MagicMirror<sup>2</sup>](https://github.com/MichMich/MagicMirror)
* Packages: chartjs, loaded vis npm install

## Installation

1. Clone this repo into `~/MagicMirror/modules` directory.
2. cd MyCovid19
3. npm install
4. Configure your `~/MagicMirror/config/config.js`:

    ```
		{
			module:"MyCovid19",
			position:"top_right",
			config:{
				countries:["Italy","USA","China","Spain","France"],
				// line colors can be any definition of color either a name ,or a hex string
				// one per country above, used in order,
				line_colors:['red','white','green','yellow','blue'],
				//				
				chart_type:"cumulative_cases",  // or "cumulative deaths"
				chart_title:"Cumulative Cases", // however u want to label
				// the vertical steps on the chart.. how tall u want it to be and how mant increments 
				ranges:{min:0,max:8000,stepSize:10000},
				// size of the chart in pixels
			    width: 400,
			    height: 500,	
			    // only used if we need to debug something
			    debug:false,
			}
		}
    ```

## Config Options

all options are case sensitive

| **Option** | **Default** | **Default** | **Info** 
| --- | --- | --- | --- |
| `countries` | REQUIRED | '' | the list of countries for which you would like the chart to report |
| `line_colors` | REQUIRED | '' | an array of colors to represent the individual country data|
| `chart_type` | OPTIONAL | 'cumulative cases' | cases reported by country |
|        |          |'cumulative deaths' |  deaths reported by country |
|        |          |'cases' | new cases reported by day by country |
|        |          |'deaths' | new deaths reported by day by country |
| `chart_title | `REQUIRED` | none | title over the chart data |
  `ranges` | `REQUIRED` | ''| the Y axis size and step rate ) |
| `width` | `OPTIONAL` | '400'  |  width of the output chart |
| `height` | `OPTIONAL`| '400' | height of the output chart |
| `backgroundColor` | `OPTIONAL` | 'black' | background of chart |



