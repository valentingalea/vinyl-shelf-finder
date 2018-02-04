'use strict';

const Config = require('./config.js');
const DG = require('./discogs.js');
const searcher = require('./search.js');
const img_download = require('./img_download.js');

module.exports = function(req, templ_file, pub_dir, on_pi) {
    console.log("Search request: " + req.query.q);
    
    var found = [];
    if (!req.query.q || req.query.q === "") {
    // if not search string, get a random one
	// BN modified this so a blank search shows whole collection...
        //var index = Math.round(Math.random() * DG.get_count());
        //found = [ DG.raw_col[index] ];
		for (var i = 0; i < DG.raw_col.length; i++) {
			var entry = DG.raw_col[i];
			found.push(entry);
		}
    } else {
    // special search commands
        if (req.query.q.indexOf('shelf:') > -1 ||
            req.query.q.indexOf('s:') > -1 ||
            req.query.q.indexOf('box:') > -1
        ) {
            var tokens = req.query.q.split(':');
            var cmd = tokens[0];
            var shelf_id = tokens[1];

            for (var i = 0; i < DG.raw_col.length; i++) {
                var entry = DG.raw_col[i];
                var n_id = DG.get_shelf_id(entry);
                
                if (cmd === 'box') {
                    if (n_id === 'box') {
                        var pos = DG.get_shelf_pos(entry);
                        if (pos == shelf_id) {
                            found.push(entry);
                        }
                    }
                } else {
                    if (parseInt(n_id, 10) == shelf_id) {
                        found.push(entry);
                    }
                }
            }

            // sort ascending by position in shelf/box
            found.sort(function (a, b) {
                return DG.get_shelf_pos(a) - DG.get_shelf_pos(b);
            });
        } else {
    // normal string search
            found = searcher.instance.search(req.query.q);
        }
    }

    var client_str = "";
    var send_release_to_client = function (input, entry) {
        var html = input;
        html = html.replace("${size}", Config.Client.ThumbSize);
        html = html.replace('${entry.title}', entry.basic_information.title);
        html = html.replace("${entry.artists}", entry.basic_information.artists[0].name);
        html = html.replace("${entry.cover}", entry.basic_information.cover_image);
        html = html.replace("${discogs}", "https://www.discogs.com/release/" + entry.id);
        html = html.replace("${find.id}", entry.id);
        html = html.replace("${play.id}", entry.id);
        return html;
    };

    var img_dl_todo = [];

    for (var i = 0; i < found.length; i++) {
        // disable the img caching on the Pi as it chokes on the requests :(
        if (!on_pi) {
            img_download.get_and_cache(found[i], pub_dir, img_dl_todo);
        }

        client_str += send_release_to_client(templ_file, found[i]);

        // cut short to not overload with requests
        // TODO: pagination support
        if (i > Config.Client.MaxResults) break;
    }

    if (!on_pi) {
        // request new cover images to be downloaded
        // bubble them up to the front of the queue
        img_download.queue.unshift(img_dl_todo);
    }

    return client_str;
}