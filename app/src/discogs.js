'use strict';

var DG = module.exports = {};

const Config = require('./config.js');
const cache = require('./cache.js');

const api = require('disconnect').Client;
const api_db = new api(Config.Discogs.UserAgent).database();
const api_col = new api(Config.Discogs.UserAgent).user().collection();
const api_get_folder = api_col.getFolder(Config.Discogs.User, Config.Discogs.CollectionFolder);

DG.api_db = api_db;
DG.api_col = api_col;
DG.raw_col = [];
DG.flt_id = function (n) { return n.field_id == Config.Discogs.Field_ShelfId; };
DG.flt_pos = function (n) { return n.field_id == Config.Discogs.Field_ShelfPos; };

const page_items = 100; // max API limit is 100
var page_count = 0;
var page_iter = 1;

function get_page(n) {
    if (typeof cache.discogs.getKey(n) === "undefined") {
        process.stdout.write('Downloading page ' + n + '...');
        
        return api_col.getReleases(Config.Discogs.User, Config.Discogs.CollectionFolder,
            { page: n, per_page: page_items });
    } else {
        process.stdout.write('Readback cached page ' + n + '...');

        return new Promise(function (resolve, reject) {
            return resolve(cache.discogs.getKey(n));
        });
    }
}

function async_loop(on_done) {
    if (page_iter <= page_count) {
        return get_page(page_iter).then(function (data) {
            console.log("done");

            var old_data = cache.discogs.getKey(page_iter);
            if (typeof old_data === "undefined") {
                cache.discogs.setKey(page_iter, data);
                cache.discogs.save({noPrune: true});
                console.log("Cached page " + page_iter);
            }

            DG.raw_col = DG.raw_col.concat(data.releases);
            
            page_iter++;
            async_loop(on_done);
        }, function (err) {
            console.log("During async_loop: " + err);
        });
    } else {
        on_done();
    }
}

var total_count = 0;

DG.get_count = function() {
    return total_count;
}

function get_cached_count() {
    var old_count = cache.discogs.getKey('count');
    if (typeof old_count === "undefined") {
        return 0;
    } else {
        return old_count;
    }
}

function start_loading(on_done) {
    page_count = Math.ceil(total_count / page_items);
    console.log("Found " + total_count + " records, retrieving all in " + page_count + " steps...");
    async_loop(on_done);
}

DG.load = function(on_done) {
    api_get_folder
    .then(function (data){  
        total_count = data.count;
        
        var old_count = get_cached_count();
        if (old_count != total_count) {
            console.log("Cache invalidated!");
    
            cache.discogs.destroy();
            cache.init_discogs();
            //TODO: this is not ideal as it can corrupt the cache
            // if the later retrievals fail
            cache.discogs.setKey('count', total_count);
            cache.discogs.save({noPrune: true});
        }
        
        start_loading(on_done);
    }, function(err) {
        console.log("discogs.getFolder failed: " + err);
    
        if (get_cached_count() > 0) {
            console.log("Offline mode!");
    
            total_count = get_cached_count();
            start_loading(on_done);
        }
    });
};