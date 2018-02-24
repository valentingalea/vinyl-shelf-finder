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

        var main_artist = data.artists[0].name;
        var main_album = data.title;
        var main_tracks = data.tracklist;

        lru.track_list.length = 0; // https://stackoverflow.com/questions/1232040/how-do-i-empty-an-array-in-javascript
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
            lru.track_list.push(track_scrobble);
        }

        // TODO: clearly this is very limited and it only supports double albums
        var radio_data = [ 
            { label: 'All Tracks', id: 'btn_all', data: lru.track_list, value: '*' },
            { label: 'Side A', id: '_A', data: lru.side('A'), value: 'A' },
            { label: 'Side B', id: '_B', data: lru.side('B'), value: 'B' },
            { label: 'Side C', id: '_C', data: lru.side('C'), value: 'C' },
            { label: 'Side D', id: '_D', data: lru.side('D'), value: 'D' },
            { label: 'Track ...', id: '_track', data: [{}], value: '0'}
        ];

        var client_str = `<div id="track-choice" data-id="${data.id}" class="btn-group" data-toggle="buttons">`;
        var radio_item = function (label, id, value, is_selected) {
            var active = is_selected ? 'active' : '';
            var checked = is_selected ? 'checked' : '';
            return `<label class="btn btn-secondary ${active}">
                    <input type="radio" id="btn${id}" value="${value}" ${checked} autocomplete="off">${label}
            </label>`;
        };
        for (var i = 0; i < radio_data.length; i++) {
            var s = radio_data[i];
            if (s.data.length > 0) {
                client_str += radio_item(s.label, s.id, s.value, i === 0);
            }
        }
        client_str += '</div><br>';

        for (var i = 1; i < radio_data.length - 1; i++) {
            var s = radio_data[i];
            if (s.data.length == 0) continue;
            
            client_str += `<br><ol class="list-group" id="lst${s.id}" data-side="${s.value}">`;
            for (var k = 0; k < s.data.length; k++) {
                client_str += `<li class="list-group-item list-group-item-action">${s.data[k].track}</li>`;
            }            
            client_str += '</ol>';
        }

        res.send(client_str);
    });
}
