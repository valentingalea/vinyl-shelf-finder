'use strict';

var lru = module.exports = {};

lru.track_list = [];

lru.side = function (S) {
    return lru.track_list.filter(function (i) {
        var _T = i.trackNumber.indexOf(S);
        var _t = i.trackNumber.indexOf(S.toLowerCase());
        return (_t >= 0) || (_T >= 0);
    });
};

lru.timestamp = function() {
    return Math.floor(Date.now() / 1000);
}

lru.filter = function (cmd, side) {
    var tracks_to_submit = undefined;

    if (cmd === '*') {
        tracks_to_submit = lru.track_list;
    } else
    if ('ABCD'.indexOf(cmd) >= 0) {
        tracks_to_submit = lru.side(cmd);
    } else {
        var n = parseInt(cmd, 10) || 0;
        var sublist = lru.side(side);
        n = n % sublist.length;
        tracks_to_submit = sublist[n];
    }

    return tracks_to_submit;    
}