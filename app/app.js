const stringifyObject = require('stringify-object');

//
// Discogs API
//
var Discogs = require('disconnect').Client;
var UserAgent = 'vinyl-shelf-finder/1.0';
var User = 'valentingalea';
var my_col = new Discogs(UserAgent).user().collection();
var json_col = [];
var total_count = 0;
const ALL = 0;

//
// Express REST server
//
var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.send(UserAgent);
});

app.get('/random', function (req, res) {
    var index = Math.round(Math.random() * total_count);
    var msg = json_col[index];
    res.send(index + "<br/><pre>" + stringifyObject(msg) + "</pre>");
});

app.get('/test', function (req, res) {
    res.send("<pre>" + stringifyObject(json_col) + "</pre>");
});

//
// Main
//
console.log("Starting...");

var get_folder = my_col.getFolder(User, ALL);

const page_items = 100;
var page_count = 0;
var page_iter = 1;

function get_page(n) {
    return my_col.getReleases(User, ALL, { page: n, per_page: page_items });
}

function start_server(){
    const port = 8080;
    app.listen(port, function () {
        console.log('Listening on ' + port + '...');
    }); 
}

function async_loop() {
    if (page_iter <= page_count) {
        return get_page(page_iter).then(function (data) {
            json_col = json_col.concat(data.releases);
            console.log(".");
            
            page_iter++;
            async_loop();
        });
    } else {
        console.log("done!");

        start_server();
    }
};

// build the collection & then start server
get_folder
.then(function (data){  
    total_count = data.count;
    page_count = Math.round(data.count / page_items);
    console.log("Found " + total_count + " records, retrieving all in " + page_count + " steps...");
    
    async_loop();
});