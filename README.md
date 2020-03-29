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
||example | ["Italy","USA","China","Spain", "Germany"]|
| `line_colors` | REQUIRED | '' | an array of colors to represent the individual country data|
|| example| ['red','white','green','yellow','#34ebde','#34ebde']|
| `chart_type` | OPTIONAL | 'cumulative_cases' | cases reported by country |
|        |          |'cumulative_deaths' |  deaths reported by country |
|        |          |'cases' | new cases reported by day by country |
|        |          |'deaths' | new deaths reported by day by country |
| `ranges` | `REQUIRED` | ''| the Y axis size and step rate ) |
||example|	{min:0,max:10000,stepSize:2000}
| `width` | `OPTIONAL` | '400'  |  width of the output chart |
| `height` | `OPTIONAL`| '400' | height of the output chart |
| `debug` | `OPTIONAL` | false ||
| `chart_title`| `OPTIONAL` | '' | title over the chart data |
| `xAxisLabel`| `OPTIONAL` | 'by date' | |
| `yAxisLabel`| `OPTIONAL` | 'Count' | |
| |||||
| `COLORS`||||
| `backgroundColor` | `OPTIONAL` | 'black' | background of chart |
|||||
| default color/font info ||specify here to change all at once|
|`defaultColor`|`OPTIONAL`|||
|`defaultFontColor`|`OPTIONAL`|||
|`defaultFontName`|`OPTIONAL`|||
|`defaultFontSize`|`OPTIONAL`|||
|----||||
| title fields ||||
| `titleFontFamily`|`OPTIONAL`|||
|`titleFontSize`|`OPTIONAL`|||
|`chartTitleColor`|`OPTIONAL`|'white'||
|`titleFontStyle`| `OPTIONAL`|| 'bold', 'italic'|
|legend fields||||
|`legendFontFamily`|`OPTIONAL`|||
|`legendFontSize`|`OPTIONAL`|||
|`legendTextColor`|`OPTIONAL`|'white'||
|`legendFontStyle`| `OPTIONAL`|| 'bold', 'italic'|
|||||
|xaxis label fields||||
|`xAxisLabelFontFamily`|`OPTIONAL`|||
|`xAxisLabelFontSize`|`OPTIONAL`|||
|`xAxisLabelColor`|`OPTIONAL`|'white'|color of the label on the horizontal axes|
|`xAxisLabelFontStyle`| `OPTIONAL`|| 'bold', 'italic'|
|||||
|xaxis tick fields|||||
|`xAxisTickLabelFontFamily`|`OPTIONAL`|||
|`xAxisTickLabelFontSize`|`OPTIONAL`|||
|`xAxisTickLabelColor`| `OPTIONAL`|'white'| |
|`xAxisTickLabelFontStyle`| `OPTIONAL`|| 'bold', 'italic'|
|||||
|yaxis label fields||||
|`yAxisLabelFontFamily`|`OPTIONAL`|||
|`yAxisLabelFontSize`|`OPTIONAL`|||
|`yAxisLabelColor`| `OPTIONAL`|'white'| |
|`yAxisLabelFontStyle`| `OPTIONAL`|| 'bold', 'italic'|
|||||
|yaxis tick fields||||
|`yAxisTickFontFamily`|`OPTIONAL`|||
|`yAxisTickFontSize`|`OPTIONAL`|||
|`yAxisTicklColor`| `OPTIONAL`|'white'| |
|`yAxisTickFontStyle`| `OPTIONAL`|| 'bold', 'italic'|
