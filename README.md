# City Explorer

**Author**: Milo & Jessica
**Version**: 1.0.1 (increment the patch/fix version number if you make more commits past your first submission)

## Overview
This is a backend server app that retreives information about a city. It returns map data, weather forecasts, nearby restaurants, meetups, trails, and movies set in the given city.

## Getting Started
After you clone the repo, you will need to run 'npm i' in your console to install the dependencies. You will also need to create an .env file and add a PORT number and your own API keys, e.g.:

PORT=3000
GEOCODE_API_KEY=[api_key]
WEATHER_API_KEY=[api_key]
YELP_API_KEY=[api_key]
MOVIE_API_KEY=[api_key]

## Architecture
This app depends on express, cors, superagent, and dotenv. It reads incoming query parameters and uses a superagent 'get()' call to return data from various APIs, which is then parsed into an object and returned to the client. 

## Change Log
01-16-2019 10:00am - Refactored, application now has functioning routes for /location, /weather
01-16-2019 11:00am - Added route and API functionality for /yelp restaurants
01-16-2019 11:45am - Added route and API functionality for /movies
<!-- Use this area to document the iterative changes made to your application as each feature is successfully implemented. Use time stamps. Here's an examples:

01-01-2001 4:59pm - Application now has a fully-functional express server, with a GET route for the location resource.
-->
## Credits and Collaborations
Code that was refactored today was based on a collaboration with Chris B yesterday.
<!-- Give credit (and a link) to other people or resources that helped you build this application. -->


> Number and name of feature: Yelp API
> Estimate of time needed to complete: 1:00
> Start time: 10:00
> Finish time: 11:00
> Actual time needed to complete: 1:00

> Number and name of feature: Movies API
> Estimate of time needed to complete: 1:00
> Start time: 11:00
> Finish time: 11:40
> Actual time needed to complete: 0:40