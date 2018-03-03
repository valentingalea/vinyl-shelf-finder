'use strict';

var heat = module.exports = {};

heat.draw = function(db, res) {
    db.select_all(function(rows){
        let played_set = [];
        for (let i = 0; i < rows.length; i++) {
            let next = Math.min(i + 1, rows.length - 1);

            let dup = (next != i) &&
                (rows[next].release == rows[i].release) &&
                (rows[next].timestamp - rows[i].timestamp < 180/*sec*/)

            let sid = parseInt(rows[i].shelf_id, 10) || 0;
            let spos = parseInt(rows[i].shelf_pos, 10) || 0;
            let boxed = (sid < 1) || (spos < 1);

            if (!dup && !boxed) {
                played_set.push(rows[i]);
            }
        }

        let played_heat = {
            min: 0,
            max: 0,
            data: []
        };
        let data_find = function(id, pos) {
            return played_heat.data.findIndex((elem) => {
                return elem.x == id && elem.y == pos;
            });
        };
        let data_push = function(id, pos) {
            let index = data_find(id, pos);
            if (index < 0) {
                index = played_heat.data.push({
                    x: pos,
                    y: id,
                    value: 0
                }) - 1;
            }
            played_heat.data[index].value += 1;
            played_heat.max = Math.max(played_heat.max, played_heat.data[index].value);
        };

        for (let i = 0; i < played_set.length; i++) {
            data_push(played_set[i].shelf_id, played_set[i].shelf_pos);
        }
        
        // TODO: move these client side
        let count_per_shelf = [44, 68, 80, 88, 68];
        for (let i = 0; i < played_heat.data.length; i++) {
            let id = played_heat.data[i].y;
            played_heat.data[i].x *= 1000 / count_per_shelf[id - 1];
            played_heat.data[i].y -= 1;
            played_heat.data[i].y *= 100;
            played_heat.data[i].y += 50;
        }

        res.send(played_heat);
    });
};

heat.list = function(searcher, res) {
    let data = searcher.search("s:3");
    let client_str = "";
    for (let i = 0; i < data.length; i++) {
        client_str += `<a href="https://www.discogs.com/release/${data[i].id}" target="_blank"><div class="item"></div></a>`;
    }
    res.send(client_str);    
};