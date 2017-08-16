//
// Debug
//
const stringifyObject = require('stringify-object');
function pretty(data) {
    return "<pre>" + stringifyObject(data) + "</pre>";
}

//
// Discogs API
//
var Discogs = require('disconnect').Client;
const UserAgent = 'vinyl-shelf-finder/1.0';
const User = 'valentingalea';
const ALL = 0; // id of main folder
var db = new Discogs(UserAgent).database();
var my_col = new Discogs(UserAgent).user().collection();
var json_col = [];
var total_count = 0;

//
// Discogs requests cache 
//
console.log("Loading cache...");
var flatCache = require('flat-cache');
const cache_file = 'discogs';
var cache = flatCache.load(cache_file, __dirname + '/cache/');

//
// Search
//
var fuseJs = require("fuse.js");
var searcher = undefined;

function init_search() {
    console.log("Indexing...");
    
    var options = {
        keys: [ 'basic_information.title', 'basic_information.artists.name' ],
        threshold: 0.15
    };
    searcher = new fuseJs(json_col, options);
}

//
// Express REST server
//
var express = require('express');
var app = express();
app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile('index.html', { root: __dirname + '/public/' }); 
});

app.get('/random', function (req, res) {
    var index = Math.round(Math.random() * total_count);
    var msg = json_col[index];
    res.send(index + "<br/>" + pretty(msg));
});

app.get('/search', function (req, res) {
    console.log("Search request: " + req.query.q);
    var found = searcher.search(req.query.q);

    var send_release_to_client = function (entry) {
        var html =
        // TODO: unhardcore artist
        // TODO: cut long names with ...
        `<div class="card">
            <img class="card-img-top" data-src="holder.js/300x300/thumb" data-original="${entry.basic_information.cover_image}">
            <div class="card-body">
                <h5>${entry.basic_information.title}</h5>
                <h6>${entry.basic_information.artists[0].name}</h6>
                <a href="#" class="btn btn-outline-primary">Find</a>
                <a href="#" class="btn btn-outline-primary">Play</a>
            </div>
        </div>`;
        return html;
    };

    var client_str = '';
    for (var i = 0; i < found.length; i++) {
        client_str += send_release_to_client(found[i]);

        // cut short to not overload with request
        // TODO: pagination support
        if (i > 10) break;
    }

    res.send(client_str);
});

app.get('/all', function (req, res) {
    res.send(pretty(json_col));
});

app.get('/test', function (req, res) {
    res.send(UserAgent);
});

app.get('/detail/:id(\\d+)', function (req, res) {
    db.getRelease(req.params.id, function(err, data){
        if (err) return;
        res.send(pretty(data));
    });
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
    if (typeof cache.getKey(n) === "undefined") {
        process.stdout.write('Downloading page ' + n + '...');
        
        return my_col.getReleases(User, ALL, { page: n, per_page: page_items });
    } else {
        process.stdout.write('Readback cached page ' + n + '...');

        return new Promise(function (resolve, reject) {
            return resolve(cache.getKey(n));
        });
    }
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
            console.log("done");

            var old_data = cache.getKey(page_iter);
            if (typeof old_data === "undefined") {
                cache.setKey(page_iter, data);
                cache.save({noPrune: true});
                console.log("Cached page " + page_iter);
            }

            json_col = json_col.concat(data.releases);
            
            page_iter++;
            async_loop();
        }, function (err) {
            console.log(err);
        });
    } else {
        init_search();
        start_server();
    }
};

// build the collection & then start server
get_folder
.then(function (data){  
    total_count = data.count;
    page_count = Math.round(data.count / page_items);
    console.log("Found " + total_count + " records, retrieving all in " + page_count + " steps...");

    var old_count = cache.getKey('count');
    if (old_count != total_count) {
        console.log("Cache invalidated!");

        flatCache.clearCacheById(cache_file);
        cache.setKey('count', total_count);
        cache.save({noPrune: true});
    }
    
    async_loop();
}, function(err) {
    console.log(err);
});