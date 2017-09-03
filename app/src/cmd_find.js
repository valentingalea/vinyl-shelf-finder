'use strict';

const DG = require('./discogs.js');
const path = require('path');
const spawn = require('child_process').spawn;

module.exports = function(req, res) {
    var entry = DG.find_by_id(req.params.id);

    if (entry && entry.notes) {
        var s_id = DG.get_shelf_id(entry);
        var s_pos = DG.get_shelf_pos(entry);
        if (s_id !== 'box' && s_id >= 0 && s_pos >= 0) {
            res.send(`finder ${s_id} ${s_pos}`);

            var cmd = spawn('./finder.py',
                [s_id, s_pos], 
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
            if (s_id === 'box') {
                res.send('TODO: cannot find in box!');
            } else {
                res.send('Err: entry invalid id/pos fields!');
            }
        }
    } else {
        res.send('Err: invalid request!');
    }
};