'use strict';

const DG = require('./discogs.js');
const cmd_search = require('./cmd_search.js');

var market = module.exports = {};

market.price_of_box = function(query, res) {
    let box = cmd_search.search(query);
    marketplace_iter(box, res);
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function marketplace_iter(box, res) {
    let output = [];
    let total = 0.;
    
    for (let i = 0; i < box.length; i++) {
        let price_info = undefined;
        price_info = await DG.market.getPriceSuggestions(box[i].id)
            .catch((err) => { console.log(err); });

        await sleep(1000./60.);

        let price = price_info["Good Plus (G+)"].value;
        total += price;
        output.push({
            'id': ("https://www.discogs.com/release/" + box[i].id),
            'price': price
        });
    }

    res.send({
        'total': total,
        'breakdown': output
    });
};
