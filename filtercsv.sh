#!/bin/bash

filter_type=$1
csv_file=$2
output_file=$3
country_or_state_filter=$4
cmd=""

#process the comma separated country list
case $filter_type in
	"countries")
		IFS=', ' read -r -a country_list <<< "$country_or_state_filter"
		#echo countrylist =$country_list
		for  country  in "${country_list[@]}"
		do
				cmd="$cmd -e $country"
		done
		# string from the csv header, to make sure its copied
		csv_header_text="iso_code"
 	;;

   "states")
		# string from the csv header, to make sure its copied
		csv_header_text="state"
		IFS=', ' read -r -a country_list <<< "$country_or_state_filter"
		#echo countrylist =$country_list
		for  country  in "${country_list[@]}"
		do
	 		cmd="$cmd -e  $country"
		done
	;;
#process the comma separated {county:state} list
   "counties")
		# string from the csv header, to make sure its copied
		csv_header_text="county"
		IFS=', ' read -r -a county_list <<< "$country_or_state_filter"
		#echo countrylist =$county_list
		for  county  in "${county_list[@]}"
		do
			countyentry=$(echo ${county:1:-1}| tr : ,)
	 		cmd="$cmd -e  $countyentry"
		done
	;;
esac
# execute grep to get just the matching lines
grep -e $csv_header_text$cmd $csv_file>$output_file


