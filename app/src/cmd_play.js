'use strict';

const DG = require('./discogs.js');
var lru = require('./lru.js');

module.exports = function(req, res) {
    DG.api_db.getRelease(req.params.id, function(err, data){
        if (err) {
            res.send(err);
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

		//BN added regex to replace parenthesis from artist names from Discogs like "Elder (2)"
		//BN https://stackoverflow.com/questions/4292468/javascript-regex-remove-text-between-parentheses added $ for end of line match only.
        var main_artist = data.artists[0].name.replace(/ *\([^)]*\) *$/g, "");
        var main_album = data.title;
        var main_tracks = data.tracklist;

        lru.track_list.length = 0; // https://stackoverflow.com/questions/1232040/how-do-i-empty-an-array-in-javascript
        var play_time = Math.floor(Date.now() / 1000);

		//BN main_tracks.length is the size of the tracklist array returned by Discogs API
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

			//BN if discogs has no track length data, make default length 3 minutes.
            if (parse_duration(t.duration) == 0) {
				play_time += 180;
			} else { play_time += parse_duration(t.duration); }
			
            lru.track_list.push(track_scrobble);
        }

        var radio_data = [ 
            { label: 'All Tracks', id: 'btn_all', data: lru.track_list, value: '*' },
            { label: 'Side A', id: 'btn_A', data: lru.side('A'), value: 'A' },
            { label: 'Side B', id: 'btn_B', data: lru.side('B'), value: 'B' },
            { label: 'Side C', id: 'btn_C', data: lru.side('C'), value: 'C' },
            { label: 'Side D', id: 'btn_D', data: lru.side('D'), value: 'D' },
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
        for (var i = 0; i < lru.track_list.length; i++) {
            client_str += `<li class="list-group-item list-group-item-action">${lru.track_list[i].track}</li>`;
        }
        client_str += '<ol>';

        res.send(client_str);
    });
}
