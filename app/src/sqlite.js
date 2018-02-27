'use strict';

var db = module.exports = {};

const path = require('path');
const location = path.join(__dirname, '..', 'cache', 'history.sqlite');

const sqlite3 = require('sqlite3');
function handler(err) {
    if (err) {
        console.error(err);
    }
}

db.create = function() {
    const sqlite = new sqlite3.Database(location, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, handler);
    if (!sqlite) return;

    const op = 
    `CREATE TABLE IF NOT EXISTS history (
        release INTEGER NOT NULL,
        timestamp INTEGER PRIMARY KEY,
        shelf_id TEXT NOT NULL,
        shelf_pos TEXT NOT NULL,
        cmd TEXT NOT NULL,
        track_data TEXT NOT NULL
    );`;
    sqlite.run(op, [], handler);

    sqlite.close(handler);
};

db.add = function(values) {
    const sqlite = new sqlite3.Database(location, sqlite3.OPEN_READWRITE, handler);
    if (!sqlite) return;

    const op = 
    `INSERT INTO history (
        release,
        timestamp,
        shelf_id,
        shelf_pos,
        cmd,
        track_data
    ) VALUES (
        $release,
        $timestamp,
        $shelf_id,
        $shelf_pos,
        $cmd,
        $track_data        
    );`;
    sqlite.run(op, values, handler);

    sqlite.close(handler);
};

db.select_all = function(callback) {
    const sqlite = new sqlite3.Database(location, sqlite3.OPEN_READ, handler);
    if (!sqlite) return;

    sqlite.all("SELECT * FROM history ORDER BY timestamp ASC;", function(err, rows){
        if (err) {
            res.send(err);
            return;
        }
        callback(rows);
    });

    sqlite.close(handler);
};