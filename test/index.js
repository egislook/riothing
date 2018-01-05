const riothing  = require('./../index.js');
riothing.config({ pub: __dirname + '', content: false });

console.log(riothing.renderHTML());