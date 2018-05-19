'use strict';

const DG = require('./discogs.js');
const cmd_search = require('./cmd_search.js');

var market = module.exports = {};

market.price_of_box = function(query, res) {
    let total = [];
    let box = cmd_search.search(query);
    marketplace_iter(box, total, res);
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function marketplace_iter(box, total, res) {
    for (let i = 0; i < box.length; i++) {
        let price = undefined;
        price = await DG.market.getPriceSuggestions(box[i].id)
            .catch((err) => { console.log(err); });
        await sleep(25);
        total.push(price);
    }
    res.send(total);
};
