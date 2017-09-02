'use strict';

//
// Config
//
const Config = require('./src/config.js');

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
// Cache 
//
const cache = require('./src/cache.js');
cache.init_discogs();

//
// Discogs API
//
const DG = require('./src/discogs.js');

//
// last.fm
//
//console.log("Preparing Last.fm...");

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
var last_fm_cache = undefined; //init_last_fm_cache();

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
};

//
// Search
//
const searcher = require('./src/search.js');

//
// Express REST server
//
const express = require('express');
const app = express();

function get_pub_dir() {
    return __dirname + '/public/';
}
app.use(express.static(get_pub_dir()));

// always have this ready
const fs = require('fs');
const templ_file = fs.readFileSync(get_pub_dir() + 'results.template.html', 'utf8');

app.get('/', function (req, res) {
    res.sendFile('index.html', { root: get_pub_dir() }); 
});

const cmd_search = require('./src/cmd_search.js');
app.get('/search', function (req, res) {
    res.send(cmd_search(req, templ_file, get_pub_dir(), running_on_pi()));
});

app.get('/all', function (req, res) {
    res.send(pretty(DG.raw_col));
});

app.get('/info', function (req, res) {
    var info = {
        client: Config.Discogs.UserAgent,
        uptime: os.uptime(),
        cpu: os.cpus(),
        archicture: os.arch(),
        type: os.type()
    };
    res.send(pretty(info));
});

const cmd_find = require('./src/cmd_find.js');
app.get('/find/:id(\\d+)', function (req, res) {
    if (!running_on_pi()) {
        res.send('Err: find can only run on the Raspberry Pi!');
        return;
    }
    cmd_find(req, res);
});

app.get('/detail/:id(\\d+)', function (req, res) {
    DG.api_db.getRelease(req.params.id, function(err, data){
        if (err) {
            res.send(pretty(err));
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

function start_server(){
    app.listen(Config.Server.Port, function () {
        console.log('Listening on ' + Config.Server.Port + '...');
    }); 
}

DG.load(function () {
    searcher.init_search(DG.raw_col);
    start_server();
});
