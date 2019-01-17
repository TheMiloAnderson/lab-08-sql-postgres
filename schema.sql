drop table if exists weathers;
drop table if exists restaurants;
drop table if exists locations;

create table locations (
  id serial primary key,
  search_query varchar(255),
  formatted_query varchar(255),
  latitude numeric(9,6),
  longitude numeric(9,6)
);

create table weathers (
  id serial primary key,
  forecast varchar(255),
  time varchar(255),
  location_id integer not null,
  foreign key (location_id) references locations (id)
);

create table restaurants (
  id serial primary key,
  name varchar(255),
  url varchar(255),
  rating numeric(2,1),
  price varchar(5),
  image_url varchar(255),
  location_id integer not null,
  foreign key (location_id) references locations (id)
);