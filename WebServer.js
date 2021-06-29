'use strict';

var CDN = require('./libs/CDN'),
	User = require('./libs/user'),
	Snowflake = require('./libs/snowflake'),
	path = require('path'),
	fetch = require('node-fetch'),
	fastify = require('fastify'),
	server = fastify({ logger: false }),
	{ cdn, bot } = require('./data/constants'),
	{ Chatutils } = require('./libs/socket.js');

server.register(require('fastify-static'), { root: path.join(__dirname, 'public') });
server.register(require('fastify-websocket'));

server.route({
	method: 'GET',
	url: '/',
	handler(request, reply){
		reply.sendFile('index.html');
	},
	wsHandler(connection, request){
		try{ new Chatutils(connection.socket, request) }catch(err){ console.error(err) }
	},
});

server.route({
	method: 'GET',
	url: '/invite',
	async handler(request, reply){
		reply.redirect(await bot.create_guild_invite(735331808450969600));
	},
});

server.route({
	method: 'GET',
	url: '/media',
	handler(request, reply){
		var cdne = cdn.resolve(request.query.cdn),
			path = request.query.path;
		
		if(!cdne || !path)return reply.code(400), reply.send();
		
		// url.searchParams.set('size', '64');
		
		reply.header('cache-control', 'public, max-age=31536000')
		
		fetch('https://' + cdne + path).then(res => {
			reply.type(res.headers.get('content-type'));
			
			reply.send(res.body);
		}).catch(err => {
			console.error(err);
			
			reply.code(500);
			reply.send();
		});
	},
});

server.listen(7200, err => {
	if(err)throw err;
	
	console.log('listening on http://127.0.0.1:7200');
});