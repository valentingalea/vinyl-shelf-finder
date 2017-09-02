'use strict';

//
// Config
//
const UserAgent = 'vinyl-shelf-finder/1.0';
const User = 'valentingalea';
const CollectionFolder = 0; // id of main folder
const Field_ShelfId = 3; // notes custom field
const Field_ShelfPos = 4; // notes custom field 

const ThumbSize = 150;
const MaxResults = 100;

const Port = 8080;

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
    return os.arch() === 'arm';
}

//
// Discogs API
//
var Discogs = require('disconnect').Client;
var db = new Discogs(UserAgent).database();
var my_col = new Discogs(UserAgent).user().collection();
var json_col = [];
var total_count = 0;
const fl_id = function (n) { return n.field_id == Field_ShelfId; };
const fl_pos = function (n) { return n.field_id == Field_ShelfPos; };

//
// Cache 
//
console.log("Loading cache...");
var flat_cache = require('flat-cache');

function get_cache_dir() {
    return __dirname + '/cache/';
}

function init_discogs_cache() {
    const discogs_cache_file = 'discogs';
    return flat_cache.load(discogs_cache_file, get_cache_dir());
}
var discogs_cache = init_discogs_cache();

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
// last.fm
//
console.log("Preparing Last.fm...");

const last_fm_secrets = { 
    apiKey: "c84750248c82a9e2254a6f600091e143", 
    apiSecret: "b55c17e5a586a92106c24e42d72d2cec",
    username: "vinyltin",
    password: "last.fmstew42pigs"
};

const last_fm_api = require('last.fm.api');
const last_fm = new last_fm_api(Object.assign(last_fm_secrets, { debug: true }));

function init_last_fm_cache() {
    const cache_file = 'last.fm';
    return flat_cache.load(cache_file, get_cache_dir());
}
var last_fm_cache = init_last_fm_cache();

var last_fm_session = function() {
    var value = last_fm_cache.getKey('session')
    if (typeof value === 'undefined') {
        last_fm.auth
        .getMobileSession({})
        .then(json => json.session)
        .then(session => {
            last_fm_session = session;
            last_fm_cache.setKey('session', session);
            last_fm_cache.save({noPrune: true});
        })
        .then(result => {
            console.log('Logged in to Last.fm');
        })
        .catch(err => {
            console.error('Error with Last.fm', err);
        });
        return undefined;
    } else {
        console.log("Found Last.fm session")
        return value;
    }
}();

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
        if (req.query.q.indexOf('shelf:') > -1 ||
            req.query.q.indexOf('s:') > -1 ||
            req.query.q.indexOf('box:') > -1
        ) {
            var tokens = req.query.q.split(':');
            var cmd = tokens[0];
            var shelf_id = tokens[1];

            var add = function (entry) {
                var f = entry.notes.filter(fl_pos);
                if (f.length > 0) {
                    found.push(entry);
                } else {
                    console.log(`Warning: found entry with no position info: ${entry.id} (${entry.basic_information.title})`);
                }
            };
            
            for (var i = 0; i < json_col.length; i++) {
                var entry = json_col[i];
                if (typeof entry.notes === 'undefined') {
                    console.log(`Warning: found entry with no shelf info: ${entry.id} (${entry.basic_information.title})`);
                    continue;
                }

                var id_def = entry.notes.filter(fl_id);
                if (id_def.length > 0) {
                    var v = id_def[0].value; 

                    if (cmd === 'box') {
                        if (v === cmd) {
                            var pos = entry.notes.filter(fl_pos);
                            if (pos.length > 0 && parseInt(pos[0].value, 10) == shelf_id) {
                                add(entry);
                            }
                        }
                    } else if (parseInt(v, 10) == shelf_id) {
                        add(entry);
                    }
                }
            }

            // sort ascending by position in shelf/box
            found.sort(function (a, b) {
                var _a = a.notes.filter(fl_pos)[0];
                var _b = b.notes.filter(fl_pos)[0];
                return parseInt(_a.value) - parseInt(_b.value);
            });
        } else {
    // normal string search
            found = searcher.search(req.query.q);
        }
    }

    var send_release_to_client = function (input, entry) {
        var html = input;
        html = html.replace("${size}", ThumbSize);
        html = html.replace('${entry.title}', entry.basic_information.title);
        html = html.replace("${entry.artists}", entry.basic_information.artists[0].name);
        html = html.replace("${entry.cover}", entry.basic_information.cover_image);
        html = html.replace("${discogs}", "https://www.discogs.com/release/" + entry.id);
        html = html.replace("${find.id}", entry.id);
        html = html.replace("${play.id}", entry.id);
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
        if (i > MaxResults) break;
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

app.get('/find/:id(\\d+)', function (req, res) {
    // if (!running_on_pi()) {
    //     res.send('Err: find can only run on the Raspberry Pi!');
    //     return;
    // }

    var entry = json_col.find(function (i) { return i.id == req.params.id; });
    if (entry && entry.notes) {
        var s_id = entry.notes.find(fl_id);
        var s_pos = entry.notes.find(fl_pos);
        if (s_id && s_pos) {
            res.send(`finder ${s_id.value} ${s_pos.value}`);

            const path = require('path');
            const spawn = require('child_process').spawn;

            var cmd = spawn('./finder.py',
                [s_id.value, s_pos.value], 
                { cwd: path.join(__dirname, '..', 'pantilthat') }
            ).on('error', err => {
                console.error(err);
            });
            cmd.stdout.on('data', (data) => {
                console.log(`finder stdout: ${data}`);
            });
            cmd.stderr.on('data', (data) => {
                console.log(`finder stderr: ${data}`);
            });
        } else {
            res.send('Err: entry has no id/pos fields!');
        }
    } else {
        res.send('Err: invalid request!');
    }
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

var lru_track_list = [];
var side = function (S) {
    return lru_track_list.filter(function (i) { 
        return i.trackNumber.indexOf(S) >= 0;
    });
};

app.get('/last.fm/:id(\\d+)/:type', function (req, res) {
    if (!lru_track_list.length) {
        res.send('invalid request');
        return;
    }

    var tracks_to_submit = undefined;
    var cmd = req.params.type;

    if (cmd === '*') {
        tracks_to_submit = lru_track_list;
    } else
    if ('ABCD'.indexOf(cmd) >= 0) {
        tracks_to_submit = side(cmd);
    } else {
        var n = parseInt(cmd, 10) || 0;
        n = n % lru_track_list.length;
        tracks_to_submit = lru_track_list[n];
    }
    if (!tracks_to_submit) {
        res.send('invalid request');
        return;
    }
    
    last_fm.track.scrobble({
        tracks: tracks_to_submit,
        sk: last_fm_session.key
    })
    .then(json => {
        console.log(json);
        res.send(`Sent to <a href="https://www.last.fm/user/${last_fm_secrets.username}" target="_blank">Last.fm</a>!`);
    })
    .catch(err => {
        console.error(err);
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
        var main_tracks = data.tracklist;

        lru_track_list.length = 0; // https://stackoverflow.com/questions/1232040/how-do-i-empty-an-array-in-javascript
        var play_time = Math.floor(Date.now() / 1000);

        for (var i = 0; i < main_tracks.length; i++) {
            var t = main_tracks[i];
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
            lru_track_list.push(track_scrobble);
        }

        var radio_data = [ 
            { label: 'All Tracks', id: 'btn_all', data: lru_track_list, value: '*' },
            { label: 'Side A', id: 'btn_A', data: side('A'), value: 'A' },
            { label: 'Side B', id: 'btn_B', data: side('B'), value: 'B' },
            { label: 'Side C', id: 'btn_C', data: side('C'), value: 'C' },
            { label: 'Side D', id: 'btn_D', data: side('D'), value: 'D' },
            { label: 'Track ...', id: 'btn_track', data: [{}], value: '0'}
        ];

        var client_str = `<div id="track-data" data-id="${data.id}" class="btn-group" data-toggle="buttons">`;
        var radio_item = function (label, id, value, is_selected) {
            var active = is_selected ? 'active' : '';
            var checked = is_selected ? 'checked' : '';
            return `<label class="btn btn-secondary ${active}">
                 <input type="radio" id="${id}" value="${value}" ${checked} autocomplete="off">${label}
            </label>`;
        };
        for (var i = 0; i < radio_data.length; i++) {
            var s = radio_data[i];
            if (s.data.length > 0) {
                client_str += radio_item(s.label, s.id, s.value, i === 0);
            }
        }
        client_str += '</div>';

        client_str += '<br><br><ol class="list-group">';
        for (var i = 0; i < lru_track_list.length; i++) {
            client_str += `<li class="list-group-item list-group-item-action">${lru_track_list[i].track}</li>`;
        }
        client_str += '<ol>';

        res.send(client_str);
    });
});

//
// Main
//
console.log("Starting...");

var get_folder = my_col.getFolder(User, CollectionFolder);

const page_items = 100; // max API limit is 100
var page_count = 0;
var page_iter = 1;

function get_page(n) {
    if (typeof discogs_cache.getKey(n) === "undefined") {
        process.stdout.write('Downloading page ' + n + '...');
        
        return my_col.getReleases(User, CollectionFolder, { page: n, per_page: page_items });
    } else {
        process.stdout.write('Readback cached page ' + n + '...');

        return new Promise(function (resolve, reject) {
            return resolve(discogs_cache.getKey(n));
        });
    }
}

function start_server(){
    app.listen(Port, function () {
        console.log('Listening on ' + Port + '...');
    }); 
}

function async_loop() {
    if (page_iter <= page_count) {
        return get_page(page_iter).then(function (data) {
            console.log("done");

            var old_data = discogs_cache.getKey(page_iter);
            if (typeof old_data === "undefined") {
                discogs_cache.setKey(page_iter, data);
                discogs_cache.save({noPrune: true});
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
    var old_count = discogs_cache.getKey('count');
    if (typeof old_count === "undefined") {
        return 0;
    } else {
        return old_count;
    }
}

function start_loading() {
    page_count = Math.ceil(total_count / page_items);
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

        discogs_cache.destroy();
        discogs_cache = init_discogs_cache();
        //TODO: this is not ideal as it can corrupt the cache
        // if the later retrievals fail
        discogs_cache.setKey('count', total_count);
        discogs_cache.save({noPrune: true});
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