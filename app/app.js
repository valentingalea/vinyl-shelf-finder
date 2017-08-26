//
// Config
//
const UserAgent = 'vinyl-shelf-finder/1.0';
const User = 'valentingalea';
const ALL = 0; // id of main folder
const thumb_size = 150;
const max_results = 100;
const port = 8080;

//
// Debug
//
const stringifyObject = require('stringify-object');
function pretty(data) {
    return "<pre>" + stringifyObject(data) + "</pre>";
}

const os = require('os');
function running_on_pi() {
    // very hacky way to determine
    // better: https://github.com/fourcube/detect-rpi
    return os.arch === 'arm';
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
// image download cache
//
var fs = require('fs');
var request = require('request');
var tress = require('tress');

function download_img_task(job, done) {
    try {
        var stream = request(job.src).pipe(fs.createWriteStream(job.dest));   
        stream.on('finish', function() {
            console.log("Cached cover image for release " + job.id + "...");
            done(undefined);
        });
    } catch (err) {
        console.log("Download failed: " + err);
        done(err);
    } 
};
var img_queue = tress(download_img_task, 8/*concurency*/);

function prepare_cover_img(entry, cache_todo) {
    var id = entry.id;
    var img_local = "img_cache/" + id + ".jpg";
    var img_file_name = get_pub_dir() + img_local;

    if (fs.existsSync(img_file_name)) {
        entry.basic_information.cover_image = img_local;
    } else {
        var download_req = {
            url: entry.basic_information.cover_image,
            headers: {
                'User-Agent': UserAgent
            }
        };
        var job = {
            id: entry.id,
            src: download_req,
            dest: img_file_name
        };
        cache_todo.push(job);
    };
};

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

// always have this ready
const templ_file = fs.readFileSync(get_pub_dir() + 'results.template.html', 'utf8');

app.get('/', function (req, res) {
    res.sendFile('index.html', { root: get_pub_dir() }); 
});

app.get('/search', function (req, res) {
    console.log("Search request: " + req.query.q);

    var found = [];
    if (!req.query.q || req.query.q === "") {
    // if not search string, get a random one
        var index = Math.round(Math.random() * total_count);
        found = [ json_col[index] ];
    } else {
    // special search commands
        if (req.query.q.indexOf('shelf:') > -1 || req.query.q.indexOf('s:') > -1) {
            var shelf_id = req.query.q.split(':')[1];
 
            for (var i = 0; i < json_col.length; i++) {
                var entry = json_col[i];
                if (typeof entry.notes === 'undefined') {
                    console.log(`Warning: found entry with no shelf info: ${entry.id} (${entry.basic_information.title})`);
                    continue;
                }

                var id_def = entry.notes.filter(function (n) { return n.field_id == 3; });
                if (id_def.length > 0) {
                    var id = parseInt(id_def[0].value, 10);
                    if (id == shelf_id) {
                        found.push(entry);
                    }
                }
            }

            // sort by left to right order in 
            // the fields are guaranteed to be there because we just constructed this
            found.sort(function (a, b) {
                var f = function (n) { return n.field_id == 4; };
                var _a = a.notes.filter(f)[0];
                var _b = b.notes.filter(f)[0];
                return parseInt(_a.value) - parseInt(_b.value);
            });
        } else {
    // normal string search
            found = searcher.search(req.query.q);
        }
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

    var client_str = "";

    // disable the img caching on the Pi as it chokes on the requests :(
    const on_pi = running_on_pi();
    var img_dl_todo = [];

    for (var i = 0; i < found.length; i++) {
        if (!on_pi) {
            prepare_cover_img(found[i], img_dl_todo);
        }

        client_str += send_release_to_client(templ_file, found[i]);

        // cut short to not overload with requests
        // TODO: pagination support
        if (i > max_results) break;
    }

    if (!on_pi) {
        // request new cover images to be downloaded
        // bubble them up to the front of the queue
        img_queue.unshift(img_dl_todo);
    }

    res.send(client_str);
});

app.get('/all', function (req, res) {
    res.send(pretty(json_col));
});

app.get('/info', function (req, res) {
    var info = {
        client: UserAgent,
        uptime: os.uptime(),
        cpu: os.cpus(),
        archicture: os.arch(),
        type: os.type()
    };
    res.send(pretty(info));
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

        // from https://stackoverflow.com/a/17098372/5760
        var parse_duration = function (str) {
            var parts = str.match(/^(\d*:)?(\d*)$/);
            if (parts) {
                var min = parseInt(parts[1], 10) || 0;
                var sec = parseInt(parts[2], 10) || 0;
                return min * 60 + sec;
            } else {
                return 0;
            }
        };        

        var main_artist = data.artists[0].name;
        var main_album = data.title;
        var track_data = data.tracklist;

        var tracklist = [];
        var play_time = Math.floor(Date.now() / 1000);
        for (var i = 0; i < track_data.length; i++) {
            var t = track_data[i];
            if ((t.position === '') || (t.type_ != 'track')) continue;

            // https://www.last.fm/api/show/track.scrobble
            var track_scrobble = {
                artist: (typeof t.artists === "undefined" ? 
                    main_artist :
                    t.artists[0].name),
                track: t.title,
                timestamp: play_time,
                album: main_album,
                trackNumber: t.position
            };

            play_time += parse_duration(t.duration);
            tracklist.push(track_scrobble);
        }

        var side = function (S) {
            return tracklist.filter(function (i) { 
                return i.trackNumber.indexOf(S) >= 0;
            });
        };
        var radio_data = [ 
            { label: 'All tracks', data: tracklist, value: '*' },
            { label: 'Side A', data: side('A'), value: 'A' },
            { label: 'Side B', data: side('B'), value: 'B' },
            { label: 'Side C', data: side('C'), value: 'C' },
            { label: 'Side D', data: side('D'), value: 'D' },
            { label: 'Track...', data: [{}], value: '?'}
        ];

        var client_str = '<div class="btn-group" data-toggle="buttons">';
        var radio_item = function (label, value, is_selected) {
            var active = is_selected ? 'active' : '';
            var checked = is_selected ? 'checked' : '';
            return `<label class="btn btn-secondary ${active}">
                 <input type="radio" value="${value} ${checked}" autocomplete="off">${label}
            </label>`;
        };
        for (var i = 0; i < radio_data.length; i++) {
            var s = radio_data[i];
            if (s.data.length > 0) {
                client_str += radio_item(s.label, s.value, i === 0);
            }
        }
        client_str += '</div>';

        client_str += '<br><br><ol class="list-group">';
        for (var i = 0; i < tracklist.length; i++) {
            client_str += `<li class="list-group-item">${tracklist[i].track}</li>`;
        }
        client_str += '<ol>';

        res.send(client_str);
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