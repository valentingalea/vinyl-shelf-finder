'use strict';

var last_fm = module.exports = {};

const Secrets = require('./last_fm_secret.js');

const lib = require('last.fm.api');
const api = new lib(Object.assign(Secrets, { debug: false }));

const cache = require('./cache.js');
cache.init_last_fm();

last_fm.session = function() {
    var value = cache.last_fm.getKey('session')
    if (typeof value === 'undefined') {
        api.auth
            .getMobileSession({})
            .then(json => json.session)
            .then(session => {
                last_fm.session = session;
                cache.last_fm.setKey('session', session);
                cache.last_fm.save({noPrune: true});
            })
            .then(result => {
                console.log('Logged in to Last.fm');
            })
            .catch(err => {
                console.error('Error with Last.fm', err);
            });
        return undefined;
    } else {
        console.log("Found Last.fm session")
        return value;
    }
}();

last_fm.scrobble = function (to_submit, res) {
    api.track.scrobble({
        tracks: to_submit,
        sk: last_fm.session.key
    })
    .then(json => {
        console.log(json);
        res.send(`Sent to <a href="https://www.last.fm/user/${Secrets.username}" target="_blank">Last.fm</a>!`);
    })
    .catch(err => {
        console.error(err);
    });
};