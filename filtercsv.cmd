@echo off
setlocal ENABLEDELAYEDEXPANSION

set filter_type=%1
set csv_file=%2
set output_file=%3
set cmd=

rem echo %*
set i=1
rem get all the unparsed parms in a string
for  %%a in (%*) do call :fixparms %%a
rem save the country, sate or county list we need
set country_or_state_filter=!a4!

rem process the comma separated country list
if "!filter_type!"=="countries" (

   for  %%a in (!country_or_state_filter!) do set cmd=!cmd! ^| %%a
   set prefix=iso_code

rem process the comma separated state list
) else if "!filter_type!"=="states" (

    for  %%a in (!country_or_state_filter!) do set cmd=!cmd! ^| %%a
	set prefix=state
	
rem process the comma separated {county:state} list
) else if "!filter_type!"=="counties" (

	set prefix=state
	
	:again
	for /F "tokens=1* delims=,"  %%a in ("!country_or_state_filter!") do ( 
		rem echo rest %%b
		set country_or_state_filter=%%b
		call :fixcounty %%a  
		if %%b neq "" goto :again
	)
	set cmd=!cmd::=,!
	rem echo county list = !cmd!
)
rem echo !cmd!
rem filter the big csv file to only the part we want
rem echo findstr /L "!prefix!!cmd!" !csv_file!
findstr /L "!prefix!!cmd!" !csv_file! >!output_file!
goto :done
:fixcounty 
	rem get the parameter  {county_name,state_name}
	set t=%1
	rem remove the braces
	set "t=%t:~1,-1%"
	rem add it to the filter string (with an | operator)
    set cmd=!cmd! ^| !t! 
	rem done here
	exit /b
:fixparms
	rem if the parm is beyond 3
	if !i! gtr 4 (
	  rem add it to parm 4
	  set a4=!a4!,%1
	) else (
		rem pass it as part of the country list
		set a4=%1
	)
	rem increment the parm counter
	set /A i="!i!+1"
	exit /b
:done

