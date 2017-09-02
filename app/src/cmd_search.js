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
        var index = Math.round(Math.random() * total_count);
        found = [ DG.raw_col[index] ];
    } else {
    // special search commands
        if (req.query.q.indexOf('shelf:') > -1 ||
            req.query.q.indexOf('s:') > -1 ||
            req.query.q.indexOf('box:') > -1
        ) {
            var tokens = req.query.q.split(':');
            var cmd = tokens[0];
            var shelf_id = tokens[1];

            var add = function (entry) {
                var f = entry.notes.filter(DG.flt_pos);
                if (f.length > 0) {
                    found.push(entry);
                } else {
                    console.log(`Warning: found entry with no position info: ${entry.id} (${entry.basic_information.title})`);
                }
            };
            
            for (var i = 0; i < DG.raw_col.length; i++) {
                var entry = DG.raw_col[i];
                if (typeof entry.notes === 'undefined') {
                    console.log(`Warning: found entry with no shelf info: ${entry.id} (${entry.basic_information.title})`);
                    continue;
                }

                var id_def = entry.notes.filter(DG.flt_id);
                if (id_def.length > 0) {
                    var v = id_def[0].value; 

                    if (cmd === 'box') {
                        if (v === cmd) {
                            var pos = entry.notes.filter(DG.flt_pos);
                            if (pos.length > 0 && parseInt(pos[0].value, 10) == shelf_id) {
                                add(entry);
                            }
                        }
                    } else if (parseInt(v, 10) == shelf_id) {
                        add(entry);
                    }
                }
            }

            // sort ascending by position in shelf/box
            found.sort(function (a, b) {
                var _a = a.notes.filter(DG.flt_pos)[0];
                var _b = b.notes.filter(DG.flt_pos)[0];
                return parseInt(_a.value) - parseInt(_b.value);
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