'use strict';

var lru = module.exports = {};

lru.track_list = [];

lru.side = function (S) {
    return lru.track_list.filter(function (i) { 
        return i.trackNumber.indexOf(S) >= 0;
    });
};

lru.timestamp = function() {
    return Math.floor(Date.now() / 1000);
}

//BN modifications so that timestamp of first track submitted is always "now"
lru.filter = function (cmd) {
    var tracks_to_submit = undefined;
	//BN new variables
	var original_timestamp_this_track = 0;
	var original_timestamp_this_side = 0;	

    if (cmd === '*') {
        tracks_to_submit = lru.track_list;
    } else
    if ('ABCD'.indexOf(cmd) >= 0) {
        tracks_to_submit = lru.side(cmd);
		//BN any scrobble action should scrobble the first track "now"
		for (var i = 0; i < tracks_to_submit.length; i++) {
			//BN get original timestamp of side A/B/C/D first track. 
			original_timestamp_this_track = tracks_to_submit[i].timestamp;
			//BN first track on side should have current timestamp
			if (i<1) {
				original_timestamp_this_side = tracks_to_submit[i].timestamp;
				tracks_to_submit[i].timestamp = Math.floor(Date.now() / 1000);
			} else {
				//all other timestamps should have TIMESTAMP =  NOW + original_timestamp_this_track - original_timestamp_this_side
				tracks_to_submit[i].timestamp = Math.floor(Date.now() / 1000) + original_timestamp_this_track - original_timestamp_this_side;
			}
		} 
    } else {
        var n = parseInt(cmd, 10) || 0;
        n = n % lru.track_list.length;
		//BN single track scrobble timestamps should be "now"
		lru.track_list[n].timestamp = Math.floor(Date.now() / 1000);
        tracks_to_submit = lru.track_list[n];
    }

    return tracks_to_submit;    
}