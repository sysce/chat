'use strict';

var fs = require('fs'),
	dns = require('dns'),
	https = require('https'),
	fetch = require('node-fetch'),
	events = require('events'),
	bcrypt = require('bcrypt'),
	Socket = require('./libs/socket'),
	{ cdn, config, db, bot, is_dev } = require('./data/constants'),
	processing = require('./libs/Processing'),
	filter = require('./libs/filter'),
	User = require('./libs/user');

Socket.Chatutils.get('token', [ 'string' ], async function(token){
	var user = await User.resolve_token(token);
	
	this.login(user);
});

Socket.Chatutils.get('invite', [ 'number' ], async function(id){
	if(!this.can_access_channel(id))throw 'Missing permission';
	
	var channel = await bot.channel(id);
	
	return channel.guild.vanityURLCode ? channel.guild.vanityURLCode : (await channel.createInvite({
		maxAge: 86400,
		maxUses: 10,
		unique: false,
	})).code;
});

Socket.Chatutils.get('headers', [ 'number', 'string' ], function(id, path){
	var host = cdn.resolve(id);
	
	return new Promise((resolve, reject) => https.request({ method: 'head', hostname: host, path: path }, res => resolve(res.headers)).end().on('error', err => console.error('headers\n', err) + reject(err.message)));
});

Socket.Chatutils.get('messages', [ 'string' ], async function(id){
	if(!this.user)throw 'no user';
	
	var in_channels = this.can_access_channel(id),
		dm = !in_channels && await db.get('select * from dms where id = ?1 and user_1 = ?2 or id = ?1 and user_2 = ?2', { 1: id, 2: socket.user.discrim });
	
	if(!in_channels && !dm)throw 'Bad channel';
	
	return dm ? dm.data ? JSON.parse(dm.data) : [] : [...(await bot.channel(id)).last50.values()];
});

Socket.Chatutils.get('signup', [ 'string', 'string' ], async (email, pass) => {
	if(socket.aso.includes('iboss') || socket.aso.includes('palm-beach'))throw {
		email: 'Signups are temp disabled'
	};
	
	var sim = await db.all('select ip from users where ip = ?', socket.ip);
	
	if(sim.length > 20)throw {
		email: 'Signups have been blocked from your network',
	};
	
	if(await db.get('select ip,signup from users where ip = ? and signup > ?', socket.ip, Date.now() - (1000 * 60 * 10)))throw {
		email: 'you are on cooldown, wait 10 minutes'
	};
	
	if(await db.get('select email from users where email = ?', email))throw {
		email: 'user with email exists',
	};
	
	if(pass.length < 8 || pass.length > 64)throw { password: 'password must be 8-64 characters' };
	
	var user = await User.signup(email, pass).catch(err => { email: err.message });
	
	if(!user)throw { email: 'User could not be created' };
	
	return socket.login(user);
});

Socket.Chatutils.get('login', [ 'string', 'string' ], async function(email, pass){
	return await User.login(email, pass).then(user => {
		this.login(user);
		
		return user.token;
	});
});

Socket.Chatutils.get('password', [ 'string', 'string' ], async (resolve, reject, current, new_pass) => {
	if(!socket.user)return reject({ 'current password': 'No user' });
	
	var current_check = await bcrypt.compare(current, socket.user.hash).catch(() => false);
	
	if(!current_check)return reject({ 'current password': 'Password does not match' });
	
	if(new_pass.length < 8 || new_pass.length > 64)return reject({ 'new password': 'password must be 8-64 characters' });
	
	var hash = await bcrypt.hash(new_pass, 10).catch(() => false);
	
	if(!hash)return reject({ 'new password': 'An unexpected error occured' });
	
	socket.user.hash = hash;
	
	socket.sync();
});

Socket.Chatutils.get('user', [ 'object' ], async (resolve, reject, data) => {
	if(!socket.user || !data)return reject({ name: 'Bad request' });
	
	if(data.name != socket.user.name || data.email != socket.user.email){
		if(!data.pass)return socket.send('user-error', { password: 'This field is required' });
		
		var checks = await bcrypt.compare(data.pass, socket.user.hash).catch(() => false);
		
		if(!checks)return socket.send('user-error', { password: 'Incorrect password' });
	}
	
	if(data.email != socket.user.email)await User.email(data.email);
	
	data.name = new filter(data.name || 'user').toString();
	data.avatar = (data.avatar || 0) % 5;
	
	if(Array.isArray(data.friends))socket.user.friends = data.friends;
	if(Array.isArray(data.blocked))socket.user.blocked = data.blocked;
	
	socket.user.name = data.name;
	socket.user.avatar = data.avatar;
	socket.user.email = data.email;
	socket.user.sync();
});

Socket.Chatutils.on('friend', [ 'string', 'number' ], async (action, discrim) => {
	if(!socket.user || socket.user.discrim == discrim)return;
	
	var user = await User.resolve_discrim(discrim).catch(err => false);
	
	if(!user)return;
	
	switch(action){
		case'add':
			
			if(user.incoming.includes(socket.user.discrim) || socket.user.outgoing.includes(discrim))return;
			
			// add to incoming
			user.incoming.push(socket.user.discrim);
			
			// add to outgoing
			socket.user.outgoing.push(discrim);
			
			break;
		case'accept':
		case'remove':
			
			// remove incoming
			var inc_cli = socket.user.incoming.indexOf(user.discrim);
			if(inc_cli != -1)socket.user.incoming.splice(inc_cli, 1);
			
			var inc_tar = user.incoming.indexOf(socket.user.discrim);
			if(inc_tar != -1)user.incoming.splice(inc_tar, 1);
			
			// remove outgoing
			var out_cli = socket.user.outgoing.indexOf(user.discrim);
			if(out_cli != -1)socket.user.outgoing.splice(out_cli, 1);
			
			var out_tar = user.outgoing.indexOf(socket.user.discrim);
			if(out_tar != -1)user.outgoing.splice(out_tar, 1);
			
			// remove friend
			var out_fri = socket.user.friends.indexOf(user.discrim);
			if(out_fri != -1)socket.user.friends.splice(out_fri, 1);
			
			var cli_fri = user.friends.indexOf(socket.user.discrim);
			if(cli_fri != -1)user.friends.splice(cli_fri, 1);
			
			if(action == 'accept')user.friends.push(socket.user.discrim), socket.user.friends.push(user.discrim);
			
			break;
	}
});

Socket.Chatutils.on('dm_close', [ 'string' ], async id => {
	var dm = await db.get('select * from dms where id = ?1 and user_1 = ?2 or id = ?1 and user_2 = ?2', { 1: id, 2: socket.user.discrim });
	
	if(!dm)return;
	
	db.run('delete from dms where id = ?', id);
	
	for(var client of Socket.clients)if(socket.user && [ dm.user_1, dm.user_2 ].includes(socket.user.discrim))socket.meta();
});

Socket.Chatutils.get('dm', [ 'number' ], async (discrim, id) => {
	// if(!socket.user.friends.includes(discrim))return resolve('home');
	
	if(!socket.user || discrim == socket.user.discrim)throw 'Bad user';
	
	var user = await User.resolve_discrim(discrim).catch(() => false);
	
	if(!user || user.discrim == socket.user.discrim)throw 'Bad user';
	
	var dm = await db.get('select id,user_1,user_2 from dms where user_1 = ?1 and user_2 = ?2 or user_1 = ?2 and user_2 = ?1', { 1: socket.user.discrim, 2: user.discrim });
	
	if(!dm){
		dm = { id: Snowflake.generate(), user_1: socket.user.discrim, user_2: user.discrim };
		
		await db.run('insert or replace into dms (id,user_1,user_2) values (?,?,?)', dm.id, dm.user_1, dm.user_2);
		
		for(var socket of Socket.clients)if(socket.user && [ dm_user_1, dm_user_2 ].includes(socket.user.discrim))await socket.meta();
	}
	
	return dm.id;
});

// should be a GET so the client can see the status and sent a unsent-like message before
Socket.Chatutils.on('message', [ 'string', 'string', 'string', 'string' ], async function(method, cid, raw_content, reference){
	if(this.vpn || !this.user || this.user.punish || this.lock || !(['send', 'edit', 'delete'].includes(method)))return;
	
	if(method == 'send')this.message_count = Math.max(this.message_count - (raw_content.length <= 2 ? 2 : 1), 0);
	
	if(this.message_count <= 0)return this.send('info', { title: 'Hey!', content: 'Stop spamming!' });
	
	// CHECK IF DELETED OR EDITED MESSAGE IS FROM AUTHOR
	// imagine doing above
	
	var rchannel = await bot.channel(cid),
		dm = !rchannel && await db.get('select * from dms where id = ?1 and user_1 = ?2 or id = ?1 and user_2 = ?2', { 1: cid, 2: this.user.discrim }),
		content = new filter(raw_content).toString();
	
	if(dm)dm.data = dm.data ? JSON.parse(dm.data) : [];
	
	var ref = ['delete', 'edit'].includes(method) && (dm ? dm.data.find(msg => msg.id == reference) : rchannel.last50.get(reference));
	
	if(method != 'delete'){
		if(this.prev_cont == content)return this.send('info', { title:'Hey!', content: 'Your message is identical to the previous one you sent' });
		
		if(!content.length)return this.send('info', { title:'Hey!', content: 'You cant send an empty message' });
	}
	
	
	if(['delete', 'edit'].includes(method) && (!ref || ref.author.name != this.user.tag || !this.user.perms.staff))return;
	
	this.prev_cont = content;
	
	if(!dm){
		var log = await bot.channel(config.log).catch(() => false);
		
		if(log){
			var log_webhook = await log.fetchWebhooks().then(webhooks => webhooks.first()).catch(() => false) || await log.createWebhook('Logging').catch(() => false);
			
			if(log_webhook)log_webhook.send({
				username: 'Logging',
				avatarURL: bot.avatar,
				embeds: [{
					author: {
						name: this.user.tag,
						icon_url: 'https://cdn.discordapp.com/embed/avatars/' + this.user.avatar + '.png',
					},
					title: method[0].toUpperCase() + method.substr(1).toLowerCase(),
					description: ('<#' + cid + '>\n' + (ref ? ref.content : raw_content)).substr(0, 1000),
					color: 0x00BBFF,
				}],
			});
		}
		
		if(Socket.locked || this.user.muted || this.user.banned || !content.length)return;
		
		if(!this.can_access_channel(rchannel.id))return console.log('no acess', rchannel.id);
		
		if(!dm && method == 'delete')return fetch('https://discord.com/api/v8/channels/' + rchannel.id + '/messages/' + ref.id, {
			method: 'DELETE',
			headers: { authorization: 'Bot ' + bot.token },
		}).then(res => res.json()).then(console.log).catch(console.error.bind(console, 'Deleting message'));
		
		var webhook = await rchannel.fetchWebhooks().then(webhooks => webhooks.first()).catch(() => false) || await rchannel.createWebhook('Chat').catch(() => false);
		
		if(!webhook)return console.error('Could not create a webhook for', rchannel.id);
		
		var webhook_url = new URL(webhook.url);
		
		fetch(webhook.url + (method != 'send' ? '/messages/' + ref.id : ''), {
			headers: { 'content-type': 'application/json' },
			method: method == 'edit' ? 'PATCH' : 'POST',
			body: JSON.stringify({
				username: this.user.tag,
				content: content,
				avatar_url: 'https://cdn.discordapp.com/embed/avatars/' + this.user.avatar + '.png',
				allowed_mentions: { parse: [] },
			}),
		}).catch(console.error.bind(console, 'Sending message'));
	}else{
		switch(method){
			case'send':
			case'edit':
				
				var message = {
					type: 'DEFAULT',
					id: method == 'edit' ? reference : Snowflake.generate(),
					tts: false,
					reactions: [],
					embeds: [],
					attachments: [],
					edited: method == 'edit',
					timestamp: Date.now(),
					channel: dm.id,
					mentions: [ [], [], [] ],
					content: content,
					author: {
						id: this.user.discrim,
						bot: true,
						color: '#FFF',
						avatar: this.user.avatar_url,
						name: this.user.tag,
					},
				};
				
				if(method == 'send')dm.data.push(message);
				else{
					var index = dm.data.findIndex(msg => msg.id == reference);
					
					if(dm.data[index] && this.user.tag == dm.data[index].author.name && dm.data[index].author.bot)dm.data[index] = message;
				}
				
				break;
			case'delete':
				
				var index = dm.data.findIndex(msg => msg.id == reference);
				
				if(this.user.mod || dm.data[index] && this.user.tag == dm.data[index].author.name && dm.data[index].author.bot){
					dm.data.splice(index, 1);
				}
				
				break;
		}
		
		db.run('update dms set data = ? where id = ?;', JSON.stringify(dm.data), dm.id);
		
		// send to any users involved
		// can probably scale to group dms
		for(var socket of Socket.clients)if(socket.user && [ dm.user_1, dm_user_2 ].includes(socket.user.discrim))socket.send('message' + (method == 'edit' ? '_update' : method == 'delete' ? '_delete' : ''), method == 'delete' ? dm.id : message, method == 'delete' ? reference : undefined);
	}
});

db.run(`create table if not exists users (
	id text primary key not null,
	token text,
	email text not null,
	name text not null,
	hash text not null,
	signup integer not null,
	laston integer not null,
	avatar integer not null,
	discrim integer not null,
	punish text,
	friends text,
	blocked text,
	incoming text,
	outgoing text,
	perm text,	
	cases text,
	ip text
);`);

db.run(`create table if not exists ipbans (
	ip text primary key not null,
	staff text not null,
	reason text not null,
	time integer not null
);`);

db.run(`create table if not exists dms (
	id text primary key not null,
	user_1 integer not null,
	user_2 integer not null,
	data text
);`);

setInterval(() => db.all('select * from users where punish is not null').then(users => users.forEach(async data => {
	var user = await User.resolve_active_user(data);
	
	if(!user.punish || user.punish[0] != 'mute')return;
	
	var punish_ends = user.punish[3] + user.punish[4];
	
	if(Date.now() > punish_ends)user.unmute('system', 'mute expired');
})), 60e3 * 2);

require('./Webpack');

// WEBSERVER

require('./WebServer');

// BOT

bot.on('ready', () => {
	console.log('Connected to Discord');
	bot.activity('Playing among us');
	
	/*Promise.all(cud.channel_ids.map(id => bot.channels.fetch(id))).then(chans => Promise.all(chans.map(async res => {
		if(!res.messages || !classes.bot_perms(res.READ_MESSAGE_HISTORY))return;
		
		res.messages.fetch({ limit: 50 }).then(async msgs => {
			cud.channels.set(res.id, res);
			
			res.last50 = new Map();
			res[typing] = [];
			
			[...msgs.values()].reverse().forEach(msg => proc_msg(msg));
			
			res.webhook = await res.fetchWebhooks().then(webhooks => webhooks.first()).catch(() => false) || await res.createWebhook('chatutils').catch(() => false);
			
			if(res.webhook)res.webhook.rurl = new URL(res.webhook.url);
		}).catch(err => console.error(err));
	}))).then(() => {
		console.log('websocket open');
	});
	*/
});

bot.on('message', async message => {
	if(message.channel.dm)return;
	
	var discrim = message.author.bot && (message.author.username.match(/^\[.*?\] : (\d+)( : .*?$|$)/) || [])[1],
		user = discrim && await db.get('select * from users where discrim = ' + discrim);
	
	if(user)message.user = await User.resolve_active_user(user);
	
	var proced = await processing.message(message);
	
	for(var socket of Socket.clients)if(socket.can_access_channel(message.channel.id))socket.send('message', proced);
});

bot.on('message_update', async (old_message, message) => {
	if(!message.channel.last50)return;
	
	var set = await processing.message(message, false);
	
	message.channel.last50.set(message.id, set);
	
	for(var socket of Socket.clients)if(socket.can_access_channel(message.channel.id))socket.send('message_update', set);
});

bot.on('message_delete', message => {
	if(!message.channel.last50)return;
	
	message.channel.last50.delete(message.id);
	
	for(var socket of Socket.clients)if(socket.can_access_channel(message.channel.id))socket.send('message_delete', message.channel.id, message.id);
});

bot.on('message_delete_bulk', messages => {
	if(!messages[0])return;
	
	var channel = messages[0].channel;
	
	if(!channel.last50)return;
	
	var chunks = messages.map(message => {
		channel.last50.delete(message.id);
		
		return [ 'message_delete', message.channel.id, message.id ];
	});
	
	for(var socket of Socket.clients)if(socket.can_access_channel(channel.id))socket.send_many(...chunks);
});


var reaction_handler = reaction => {
	if(!reaction.message || !cud.channels.has(reaction.message.channel.id))return;
	
	var rchannel = cud.channels.get(reaction.message.channel.id),
		last50_message = rchannel.last50.get(reaction.message.id);
	
	if(!last50_message)return;
	
	var added = proc_msg(reaction.message, false);
	
	classes.io.bc('message_react', reaction.message.channel.id, reaction.message.id, added.reactions);
};

/*-bot.on('reaction', reaction_handler);
bot.on('reaction_remove', reaction_handler);
bot.on('reaction_remove_all', message => reaction_handler({ message: message }));

bot.on('typing_start', (channel, user) => {
	if(!cud.channels.has(channel.id))return;
	
	var rchannel = cud.channels.get(channel.id),
		mem = channel.guild.members.cache.find(member => member.id == user.id),
		name = mem ? mem.displayName : user.username;
	
	rchannel[typing].push({ id: user.id, name: name });
	
	setTimeout(() => {
		var found = rchannel[typing].findIndex(typer => typer.id == user.id);
		
		if(found != -1)rchannel[typing].splice(found, 1);
		
		classes.io.clients.forEach(io => io.typing());
	}, 5000);
	
	classes.io.clients.forEach(io => io.typing());
});*/

// COMMANDS

require('./data/commands.js');

bot.login(config.token);

process.on('uncaughtException', err => console.error('uncaught:\n', err));