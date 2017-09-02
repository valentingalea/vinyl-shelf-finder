'use strict';

const DG = require('./discogs.js');
const path = require('path');
const spawn = require('child_process').spawn;

module.exports = function(req, res) {
    var entry = DG.raw_col.find(function (i) {
        return i.id == req.params.id; }
    );

    if (entry && entry.notes) {
        var s_id = entry.notes.find(DG.flt_id);
        var s_pos = entry.notes.find(DG.flt_pos);
        if (s_id && s_pos) {
            res.send(`finder ${s_id.value} ${s_pos.value}`);

            var cmd = spawn('./finder.py',
                [s_id.value, s_pos.value], 
                { cwd: path.join(__dirname, '..', '..', 'pantilthat') }
            ).on('error', err => {
                console.error(err);
            });
            cmd.stdout.on('data', (data) => {
                console.log(`finder stdout: ${data}`);
            });
            cmd.stderr.on('data', (data) => {
                console.log(`finder stderr: ${data}`);
            });
        } else {
            res.send('Err: entry has no id/pos fields!');
        }
    } else {
        res.send('Err: invalid request!');
    }
};