'use strict';

var cache = module.exports = {};

cache.instance = require('flat-cache');

cache.get_dir = function () {
    const path = require('path');
    return path.join(__dirname, '..', 'cache');
}

cache.discogs = undefined;
cache.init_discogs = function () {
    console.log("Loading Discogs cache...");

    cache.discogs = cache.instance.load('discogs', cache.get_dir());
};

cache.last_fm = undefined;
cache.init_last_fm = function () {
    console.log("Loading Last.fm cache...");

    cache.last_fm = cache.instance.load('last.fm', cache.get_dir());
};