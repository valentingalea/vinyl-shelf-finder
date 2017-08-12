const stringifyObject = require('stringify-object');

//
// Discogs API
//
var Discogs = require('disconnect').Client;
var UserAgent = 'vinyl-shelf-finder/1.0';
var User = 'valentingalea';

// var db = new Discogs(UserAgent).database();
// db.getRelease(176126, function(err, data){
//     console.log(data);
// });

var col = new Discogs(UserAgent).user().collection();


//
// Express REST server
//
var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.send(UserAgent);
});

app.get('/random', function (req, res) {
    col.getReleases(User, 0, {}, function(err, data){
        var count = data.releases.length;
        var index = Math.round(Math.random() * count);
        var msg = data.releases[index];
        res.send("<pre>" + stringifyObject(msg) + "</pre>");
    });
});

app.listen(8080, function () {
    console.log('Listening...');
});