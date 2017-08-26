//
// Config
//
const UserAgent = 'vinyl-shelf-finder/1.0';
const User = 'valentingalea';
const ALL = 0; // id of main folder
const thumb_size = 150;
const max_results = 10;
const port = 8080;

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
function get_cache_dir() {
    return __dirname + '/cache/';
}
function init_cache() {
    return flatCache.load(cache_file, get_cache_dir());
}
var cache = init_cache();

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

function get_pub_dir() {
    return __dirname + '/public/';
}
app.use(express.static(get_pub_dir()));

var fs = require('fs');
var request = require('request');

// always have this ready
const templ_file = fs.readFileSync(get_pub_dir() + 'results.template.html', 'utf8');

app.get('/', function (req, res) {
    res.sendFile('index.html', { root: get_pub_dir() }); 
});

app.get('/search', function (req, res) {
    console.log("Search request: " + req.query.q);

    var found = undefined;
    if (!req.query.q || req.query.q === "") {
        var index = Math.round(Math.random() * total_count);
        found = [ json_col[index] ];
    } else {
        found = searcher.search(req.query.q);
    }

    var send_release_to_client = function (input, entry) {
        var html = input;

        html = html.replace("${size}", thumb_size);
        html = html.replace('${entry.title}', entry.basic_information.title);
        html = html.replace("${entry.artists}", entry.basic_information.artists[0].name);
        html = html.replace("${entry.cover}", entry.basic_information.cover_image);
        html = html.replace("${btn.find}", "https://www.discogs.com/release/" + entry.id);
        html = html.replace("${btn.play}", entry.id);

        return html;
    };

    var prepare_cover_img = function (entry) {
        var id = entry.id;

        var img_local = "img_cache/" + id + ".jpg";
        var img_file_name = get_pub_dir() + img_local;

        if (fs.existsSync(img_file_name)) {
            entry.basic_information.cover_image = img_local;
        } else {
            console.log("Caching cover image for release " + id + "...");
            var options = {
                url: entry.basic_information.cover_image,
                headers: {
                    'User-Agent': UserAgent
                }
            };
            try {
                request(options).pipe(fs.createWriteStream(img_file_name));   
            } catch (err) {
                console.log("Download failed: " + err);
            }            
        };
    };

    var client_str = "";
    for (var i = 0; i < found.length; i++) {
        prepare_cover_img(found[i]);

        client_str += send_release_to_client(templ_file, found[i]);

        // cut short to not overload with requests
        // TODO: pagination support
        if (i > max_results) break;
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
        if (err) {
            es.send(pretty(err));
            return;
        }
        res.send(pretty(data));
    });
});

app.get('/play/:id(\\d+)', function (req, res) {
    db.getRelease(req.params.id, function(err, data){
        if (err) {
            res.send(pretty(err));
            return;
        }

        var main_artist = data.artists[0].name;
        var main_album = data.title;
        var track_data = data.tracklist;

        var tracklist = [];
        for (var i = 0; i < track_data.length; i++) {
            var t = track_data[i];
            if ((t.position === '') || (t.type_ != 'track')) continue;

            // https://www.last.fm/api/show/track.scrobble
            var track_scrobble = {
                artist: (typeof t.artists === "undefined" ? 
                    main_artist :
                    t.artists[0].name),
                track: t.title,
                timestamp: 0,
                album: main_album,
                trackNumber: t.position
            };

            tracklist.push(track_scrobble);
        }

        res.send(pretty(tracklist));
    });
});

//
// Main
//
console.log("Starting...");

var get_folder = my_col.getFolder(User, ALL);

const page_items = 100; // max API limit is 100
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
            console.log("During async_loop: " + err);
        });
    } else {
        init_search();
        start_server();
    }
};

function get_cached_count() {
    var old_count = cache.getKey('count');
    if (typeof old_count === "undefined") {
        return 0;
    } else {
        return old_count;
    }
}

function start_loading() {
    page_count = Math.round(total_count / page_items);
    console.log("Found " + total_count + " records, retrieving all in " + page_count + " steps...");
    async_loop();
}

// build the collection & then start server
get_folder
.then(function (data){  
    total_count = data.count;
    var old_count = get_cached_count();
    if (old_count != total_count) {
        console.log("Cache invalidated!");

        cache.destroy();
        cache = init_cache();
        //TODO: this is not ideal as it can corrupt the cache
        // if the later retrievals fail
        cache.setKey('count', total_count);
        cache.save({noPrune: true});
    }
    
    start_loading();
}, function(err) {
    console.log("discogs.getFolder failed: " + err);

    if (get_cached_count() > 0) {
        console.log("Offline mode!");

        total_count = get_cached_count();
        start_loading();
    }
});