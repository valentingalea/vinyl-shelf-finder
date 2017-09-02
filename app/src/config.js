'use strict';

const Config = {
    Discogs: {
        UserAgent: 'vinyl-shelf-finder/1.0',
        User: 'valentingalea',
        CollectionFolder: 0, // id of main folder
        Field_ShelfId: 3, // notes custom field
        Field_ShelfPos: 4 // notes custom field 
    },

    Client: {
        ThumbSize: 150,
        MaxResults: 100    
    },

    Server: {
        Port: 8080
    }
};

module.exports = Config;