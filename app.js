var Discogs = require('disconnect').Client;
var UserAgent = 'vinyl-shelf-finder/1.0';
var User = 'valentingalea';

//var db = new Discogs(UserAgent).database();
// db.getRelease(176126, function(err, data){
// 	console.log(data);
// });

var col = new Discogs(UserAgent).user().collection();
col.getReleases(User, 0, {}, function(err, data){
    var count = data.releases.length;
    var index = Math.round(Math.random() * count);
	console.log(data.releases[index]);
});