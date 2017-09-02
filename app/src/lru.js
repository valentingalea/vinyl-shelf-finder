'use strict';

var lru = module.exports = {};

lru.track_list = [];

lru.side = function (S) {
    return lru.track_list.filter(function (i) { 
        return i.trackNumber.indexOf(S) >= 0;
    });
};

lru.filter = function (cmd) {
    var tracks_to_submit = undefined;

    if (cmd === '*') {
        tracks_to_submit = lru.track_list;
    } else
    if ('ABCD'.indexOf(cmd) >= 0) {
        tracks_to_submit = side(cmd);
    } else {
        var n = parseInt(cmd, 10) || 0;
        n = n % lru.track_list.length;
        tracks_to_submit = lru.track_list[n];
    }

    return tracks_to_submit;    
}