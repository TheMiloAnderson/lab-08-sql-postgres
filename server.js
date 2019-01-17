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
app.get('/yelp', getRestaurants);
app.get('/movies', getMovies);

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// --- LOCATION --- //

function getLocation(req, res) {
  const locationHandler = {
    query: req.query.data,
    cacheHit: (results) => {
      console.log('Got Location SQL');
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
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;

  return superagent.get(url)
    .then((apiResponse) => {
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
  return client.query(SQL, values);
};

// --- GENERIC DATA LOOKUP --- //

function dataLookup(handler, table) {
  const SQL = `SELECT * FROM ${table} WHERE location_id=$1`;
  const values = [handler.location.id];
  client.query(SQL, values)
    .then((result) => {
      if (result.rowCount > 0) {
        console.log(`Got ${table} data from SQL`);
        handler.cacheHit(result);
      } else {
        console.log(`Got ${table} data from API`);
        handler.cacheMiss();
      }
    })
    .catch(err => handleError(err));
}

// --- WEATHER --- //

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
  dataLookup(handler, 'weathers');
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

// --- RESTAURANTS --- //

function getRestaurants(req, res) {
  const handler = {
    location: req.query.data,
    cacheHit: function(result) {
      res.send(result.rows);
    },
    cacheMiss: function() {
      Restaurants.fetch(req.query.data)
        .then((results) => res.send(results))
        .catch(console.error);
    }
  }
  dataLookup(handler, 'restaurants');
}

Restaurants.fetch = function(location) {
  const url = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${location.latitude}&longitude=${location.longitude}`;
  return superagent.get(url)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then((result) => {
      const foodReviews = result.body.businesses.map((restaurant) => {
        const listing = new Restaurants(restaurant);
        listing.save(location.id);
        return listing;
      });
      return foodReviews;
    });
}

function Restaurants(restaurant) {
  this.name = restaurant.name;
  this.url = restaurant.url;
  this.rating = restaurant.rating;
  this.price = restaurant.price;
  this.image_url = restaurant.image_url;
}

Restaurants.prototype.save = function(id) {
  const SQL = `INSERT INTO restaurants (name, url, rating, price, image_url, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
}

// --- MOVIES --- //

function getMovies(req, res) {
  const handler = {
    location: req.query.data,
    cacheHit: function(result) {
      res.send(result.rows);
    },
    cacheMiss: function() {
      Movies.fetch(req.query.data)
        .then((results) => res.send(results))
        .catch(console.error);
    }
  }
  dataLookup(handler, 'movies');
}

Movies.fetch = function(location) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${location.search_query}`;
  return superagent.get(url)
    .then((result) => {
      const movies = result.body.results.map((movie) => {
        const movieObj = new Movies(movie);
        movieObj.save(location.id);
        return movieObj;
      });
      return movies;
    });
}

function Movies(movie) {
  this.title = movie.title;
  this.released_on = movie.release_date;
  this.total_votes = movie.vote_count;
  this.average_votes = movie.vote_average;
  this.popularity = movie.popularity;
  this.image_url = movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : 'http://media.graytvinc.com/images/810*607/Movie32.jpg';
  if (movie.overview.length > 254) {
    movie.overview = movie.overview.slice(0, 250) + '...';
  }
  this.overview = movie.overview;
}

Movies.prototype.save = function(id) {
  const SQL = `INSERT INTO movies (title, released_on, total_votes, average_votes, popularity, image_url, overview, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
}

function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Looks like today\'s not your day');
}
