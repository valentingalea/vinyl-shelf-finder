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
