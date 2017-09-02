'use strict';

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
// Sub modules
//
const Config = require('./src/config.js');
const cache = require('./src/cache.js');
cache.init_discogs();
const DG = require('./src/discogs.js');
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

app.get('/detail/:id(\\d+)', function (req, res) {
    DG.api_db.getRelease(req.params.id, function(err, data){
        if (err) {
            res.send(pretty(err));
            return;
        }
        res.send(pretty(data));
    });
});

const cmd_search = require('./src/cmd_search.js');

app.get('/search', function (req, res) {
    res.send(cmd_search(req, templ_file, get_pub_dir(), running_on_pi()));
});

const cmd_find = require('./src/cmd_find.js');

app.get('/find/:id(\\d+)', function (req, res) {
    if (!running_on_pi()) {
        res.send('Err: find can only run on the Raspberry Pi!');
        return;
    }
    cmd_find(req, res);
});

const lru = require('./src/lru.js');
const last_fm = require('./src/last_fm');

app.get('/last.fm/:id(\\d+)/:type', function (req, res) {
    if (!lru.track_list.length) {
        res.send('invalid request');
        return;
    }

    var to_submit = lru.filter(req.params.type);
    if (!to_submit) {
        res.send('invalid request');
        return;
    }
    
    last_fm.scrobble(to_submit, res);
});

const cmd_play = require('./src/cmd_play.js');
app.get('/play/:id(\\d+)', function (req, res) {
    cmd_play(req, res);
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
