'use strict';

var searcher = module.exports = {};

const fuseJs = require("fuse.js");
searcher.instance = undefined;

searcher.init_search = function(data) {
    console.log("Indexing...");
    
    var options = {
        keys: [ 'basic_information.title', 'basic_information.artists.name' ],
        threshold: 0.15
    };
    searcher.instance = new fuseJs(data, options);
}
