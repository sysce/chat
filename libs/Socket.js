'use strict';

var constants = require('../data/constants'),
	User = require('./user'),
	Events = require('./events');

class Socket extends Events.Type {
	static clients = [];
	constructor(websocket, request){
		super();
		
		this.timers = [];
		this.websocket = websocket;
		this.request = request;
		
		this.ip = request.headers['cf-connecting-ip'] || request.headers['x-real-ip'] || request.socket.remoteAddress || '127.0.0.1';
		
		var ip_info = constants.ip.lookup(this.ip);
		
		this.asn = ip_info.asn || 0;
		this.aso = ip_info.aso || '';
		this.vpn = ip_info.vpn || false;
		
		// first 4 fields
		this.short_ip = this.ip.length > 15 ? this.ip.split(':').splice(0, 4).join(':') : this.ip;
		
		// keepalive polls 30 seconds
		// response needed in at most 60 seconds
		this.keepalive = this.setTimeout(() => this.close(), 6e4);
		this.setInterval(() => this.send('ali'), 3e4);
		this.start = Date.now();
		
		this.websocket.on('close', () => this.closing());
		
		Socket.clients.push(this);
		
		this.websocket.on('message', raw => {
			var data = JSON.parse(raw);
			
			(data && data.i) ? data.d.forEach(data => this.emit(...data)) : this.emit(...data);
		});
	}
	setInterval(callback, interval){
		var timer = setInterval(callback, interval);
		
		this.timers.push(timer);
		
		return timer;
	}
	setTimeout(callback, interval){
		var timer = setTimeout(callback, interval);
		
		this.timers.push(timer);
		
		return timer;
	}
	closing(){
		this.emit('close');
		
		this.active = false;
		
		for(var timer of this.timers)if(timer.refresh)clearInterval(timer);
		else clearTimeout(timer);
		
		for(var ind in Socket.clients)if(Socket.clients[ind] == this)Socket.clients.splice(ind, 1);
	}
	close(){
		this.websocket.close();
		this.closing();
	}
	send(...data){
		var seen = [],
			safe_data = JSON.stringify(data, (key, value) => {
				if(typeof value != 'number' && !value)return; // optimize size
				return typeof value == 'object'
					? !seen.includes(value)
						? (seen.push(value), value) 
							: null
							: value;
			});
		
		this.websocket.send(safe_data);
		
		return true;
	}
	send_many(...chunks){
		this.websocket.send(JSON.stringify({
			i: true, // indicate this is multi-message
			d: chunks,
		}));
	}
};

Socket.get = Events.Type.prototype.get;
Socket.on = Events.Type.prototype.on;
Socket.once = Events.Type.prototype.once;

Socket.on('ali', function(){
	this.keepalive.refresh();
});

class ChatutilsSocket extends Socket {
	constructor(...args){
		super(...args);
		
		this.message_count = 2;
		this.setInterval(() => this.message_count = Math.min(this.message_count + 1, 3), 1650);
		
		/*
		this.sync();
		this.typing();
		*/
	}
	closing(){
		super.closing();
		
		for(var socket of Socket.clients)if(socket.user && this.user.friends.includes(socket.user.discrim))socket.sync();
		
		// delete this.user;
	}
	async token(token){
		return await User.resolve_token(token).then(user => this.login(user));
	}
	typing(){
		this.send('typing', [...this.channels.values()].map(channel => channel.typing));
	}
	ipbanned(){
		return constants.db.get('select ip from ipbans where ip = ?', this.short_ip).then(val => val ? true : false);
	}
	login(user){
		if(!user)return console.trace('no user');
		
		// todo
		this.user = user;
		
		this.user.ip = this.ip;
		this.user.laston = new Date();
		
		this.sync();
		this.meta();
		
		Socket.clients.forEach(io => io.user && this.user.friends.includes(io.user.discrim) && io.sync());
	}
	reload(){
		this.send('action', 'reload');
	}
	async meta(){
		if(!this.user)return;
		
		var guilds = [ {
			name: 'Home',
			id: 'home',
			channels: [{ name: 'Friends', id: 'friends', category: ['', 0], perms: {} }],
		} ];
		
		if(this.user)await constants.db.all('select * from dms where user_1 = ? or user_2 = ?', this.user.discrim, this.user.discrim).then(async dms => {
			for(var ind in dms){
				if(!this.user)return;
				
				var dm = dms[ind],
					msgs = dm.data && JSON.parse(dm.data),
					user = await User.resolve_discrim(dm.user_1 == this.user.discrim ? dm.user_2 : dm.user_1);
				
				guilds[0].channels.push({
					pos: msgs && msgs[msgs.length - 1] && msgs[msgs.length - 1].timestamp || 0,
					id: dm.id,
					name: user.name,
					category: { id: 0, name: 'Direct Messages' },
					perms: { SEND_MESSAGES: true },
					dm: 'https://cdn.discordapp.com/embed/avatars/' + user.avatar + '.png',
				});
			}
		});
		
		if(this.user)for(var channel_id of this.channels){
			var channel = await constants.bot.channel(channel_id),
				guild = guilds.find(guild => guild.id == channel.guild.id);
			
			if(this.can_access_channel(channel_id)){
				if(!guild)guild = {
					name: channel.guild.name,
					id: channel.guild.id,
					icon: channel.guild.icon,
					channels: [],
				}, guilds.push(guild);
				
				guild.channels.push({
					category: channel.parent ? [ channel.parent.id, channel.parent.name ] : [ 0, '' ],
					pos: channel.rawPosition,
					name: channel.name,
					id: channel.id,
					topic: channel.topic || '',
					primary: false,
					perms: { SEND_MESSAGES: true },
				});
			}
		}
		
		this.send('meta', guilds);
	}
	async sync(user){
		if(this.user != user && user)this.user = user;
		
		if(!this.user)return;
		
		// Socket.locked
		this.send('user', await this.user.json(), false);
	}
	can_access_channel(id){
		if(!this.user)return false;

		for(var perm in this.user.perms)if(!constants.perms[perm])console.warn('Perm ' + perm + ' not setup');
		else if(this.user.perms[perm] && constants.perms[perm].channels.includes(id))return true;
		
		return false;
	}
	get channels(){
		var channels = [];
		
		for(var perm in constants.perms)if(this.user && this.user.perms[perm])channels.push(...constants.perms[perm].channels);
		
		return channels;
	}
}

ChatutilsSocket[Events.listeners] = Socket[Events.listeners];
Socket.Chatutils = ChatutilsSocket;
module.exports = Socket;