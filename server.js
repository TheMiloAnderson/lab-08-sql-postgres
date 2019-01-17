'use strict';

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

require('dotenv').config();
const PORT = process.env.PORT;

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));

const app = express();

app.use(cors());

app.get('/location', getLocation);
app.get('/weather', getWeather);
//app.get('/yelp', searchFood);
//app.get('/movies', searchMovies);

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
/* 
function searchToLatLong(req, res) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${req.query.data}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(url)
    .then((apiResponse) => {
      let location = new Location(req.query.data, apiResponse);
      res.send(location);
    })
    .catch((err) => handleError(err, res));
}

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
}
 */

// --- LOCATION --- //

function getLocation(req, res) {
  const locationHandler = {
    query: req.query.data,
    cacheHit: (results) => {
      console.log('Got SQL');
      res.send(results.rows[0]);
    },
    cacheMiss: () => {
      Location.fetchLocation(req.query.data)
        .then(data => res.send(data));
    }
  }
  Location.lookupLocation(locationHandler);
}

Location.lookupLocation = (handler) => {
  const SQL = `SELECT * FROM  locations WHERE search_query=$1`;
  const values = [handler.query];
  //console.log('lookupLocation', values);
  return client.query(SQL, values)
    .then((results) => {
      if (results.rowCount > 0) {
        handler.cacheHit(results);
      } else {
        handler.cacheMiss();
      }
    })
    .catch(console.error);
}

Location.fetchLocation = (query) => {
  //console.log('query param', query);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;

  return superagent.get(url)
    .then((apiResponse) => {
      //console.log('apiResponse', apiResponse.body.results)
      if (!apiResponse.body.results.length) {
        throw 'No Data';
      } else {
        let location = new Location(query, apiResponse.body.results[0]);
        return location.save()
          .then((result) => {
            location.id = result.rows[0].id;
            return location;
          });
      }
    })
    .catch((err) => handleError(err));
};

function Location(query, data) {
  this.search_query = query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}

Location.prototype.save = function() {
  let SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude)
    VALUES ($1, $2, $3, $4) RETURNING id;`;
  let values = [this.search_query, this.formatted_query, this.latitude, this.longitude];
  //console.log('THESE ARE THE VALUES', values);
  return client.query(SQL, values);
};

function getWeather(req, res) {
  const handler = {
    location: req.query.data,
    cacheHit: function(result) {
      res.send(result.rows);
    },
    cacheMiss: function() {
      Weather.fetch(req.query.data)
        .then((results) => res.send(results))
        .catch(console.error);
    }
  }
  Weather.lookup(handler);
}

Weather.lookup = function(handler) {
  const SQL = `SELECT * FROM weathers WHERE location_id=$1`;
  const values = [handler.location.id];
  client.query(SQL, values)
    .then((result) => {
      if (result.rowCount > 0) {
        console.log('Got weather from SQL');
        handler.cacheHit(result);
      } else {
        console.log('Got weather from API');
        handler.cacheMiss();
      }
    })
    .catch(err => handleError(err));
}

Weather.fetch = function(location) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${location.latitude},${location.longitude}`;
  return superagent.get(url)
    .then((result) => {
      const weatherSummaries = result.body.daily.data.map((day) => {
        const summary = new Weather(day);
        summary.save(location.id);
        return summary;
      });
      return weatherSummaries;
    });
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000)
    .toLocaleDateString('en-US', {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'});
}

Weather.prototype.save = function(id) {
  const SQL = `INSERT INTO weathers (forecast, time, location_id) VALUES ($1, $2, $3);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
}

/* 
function searchWeather(req, res) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;

  return superagent.get(url)
    .then((weatherResponse) => {
      const weatherSummaries = weatherResponse.body.daily.data.map((day) => {
        return new Weather(day);
      });
      res.send(weatherSummaries);
    })
    .catch((err) => handleError(err, res));
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000)
    .toLocaleDateString('en-US', {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'});
}
 */
function searchFood(req, res) {
  const url = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${req.query.data.latitude}&longitude=${req.query.data.longitude}`;

  return superagent.get(url)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then((foodResponse) => {
      const foodReviews = foodResponse.body.businesses.map((restaurant) => {
        return new Food(restaurant);
      });
      res.send(foodReviews);
    })
    .catch((err) => handleError(err, res));
}

function Food(restaurant) {
  this.name = restaurant.name;
  this.url = restaurant.url;
  this.rating = restaurant.rating;
  this.price = restaurant.price;
  this.image_url = restaurant.image_url;
}

function searchMovies(req, res) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${req.query.data.search_query}`;

  return superagent.get(url)
    .then((moviesResponse) => {
      const areaMovies = moviesResponse.body.results.map((movie) => {
        return new Movie(movie);
      });
      res.send(areaMovies);
    })
    .catch((err) => handleError(err, res));
}

function Movie(movie) {
  this.title = movie.title;
  this.released_on = movie.release_date;
  this.total_votes = movie.vote_count;
  this.average_votes = movie.vote_average;
  this.popularity = movie.popularity;
  this.image_url = movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : 'http://media.graytvinc.com/images/810*607/Movie32.jpg';
  this.overview = movie.overview;
}

function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Looks like today\'s not your day');
}
