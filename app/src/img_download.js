'use strict';

var img_download = module.exports = {};

const fs = require('fs');
const request = require('request');
const tress = require('tress');

function download_img_task(job, done) {
    try {
        var stream = request(job.src).pipe(fs.createWriteStream(job.dest));   
        stream.on('finish', function() {
            console.log("Cached cover image for release " + job.id + "...");
            done(undefined);
        });
    } catch (err) {
        console.log("Download failed: " + err);
        done(err);
    } 
};

img_download.queue = tress(download_img_task, 8/*concurency*/);

img_download.get_and_cache = function (entry, img_dir, cache_todo) {
    var img_local = "img_cache/" + entry.id + ".jpg";
    var img_file_name = img_dir + img_local;

    if (fs.existsSync(img_file_name)) {
        entry.basic_information.cover_image = img_local;
    } else {
        var download_req = {
            url: entry.basic_information.cover_image,
            headers: {
                'User-Agent': Config.Discogs.UserAgent
            }
        };
        var job = {
            id: entry.id,
            src: download_req,
            dest: img_file_name
        };
        cache_todo.push(job);
    };
};