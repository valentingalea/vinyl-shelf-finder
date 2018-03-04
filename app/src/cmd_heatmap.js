'use strict';

const DG = require('./discogs.js');

var heat = module.exports = {};

heat.draw = function(db, res) {
    // the whole db of records in heatmap.js format
    // which means that `x` is the record position in the shelf
    // and `y` is shelf id (or number)
    let played_heat = {
        min: 0,
        max: 0,
        data: [],
        shelf_count: []
    };

    // calculate the number of records on a shelf
    let flt = function(arr, id) {
        return arr.filter(function(entry) {
            return DG.get_shelf_id(entry) == id;
        });
    };
    for (let i = 1; i <= 5; i++ ) {
        played_heat.shelf_count.push(flt(DG.raw_col, i).length);
    }

    // insert all records owned and assume 0 play times
    for (let i = 0; i < DG.raw_col.length; i++) {
        let entry = DG.raw_col[i];
        var s_id = DG.get_shelf_id(entry);
        if (s_id === 'box') continue;
        var s_pos = DG.get_shelf_pos(entry);

        played_heat.data.push({
            x: s_pos,
            y: s_id,
            value: 0,
            release: entry.id
        });
    }

    // calculate the actual heatmap info: the amount of times
    // a particular record has been played
    db.select_all(function(rows){
        let played_set = [];
        for (let i = 0; i < rows.length; i++) {
            let next = Math.min(i + 1, rows.length - 1);

            let dup = (next != i)
                && (rows[next].release == rows[i].release)
                //&& (rows[next].timestamp - rows[i].timestamp < 180) // 3 min apart
            ;

            let sid = parseInt(rows[i].shelf_id, 10) || 0;
            let spos = parseInt(rows[i].shelf_pos, 10) || 0;
            let boxed = (sid < 1) || (spos < 1);

            if (!dup && !boxed) {
                played_set.push(rows[i]);
            }
        }

        let data_find = function(_x, _y) {
            return played_heat.data.findIndex((elem) => {
                return elem.x == _x && elem.y == _y;
            });
        };
        let data_push = function(_x, _y, rel) {
            let index = data_find(_x, _y);
            if (index < 0) return;
            played_heat.data[index].value += 1;
            played_heat.max = Math.max(played_heat.max, played_heat.data[index].value);
        };
        for (let i = 0; i < played_set.length; i++) {
            data_push(
                played_set[i].shelf_pos,
                played_set[i].shelf_id,
                played_set[i].release
            );
        }
        
        res.send(played_heat);
    });
};
