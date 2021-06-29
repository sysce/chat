'use strict';

var Events = require('../../libs/Events');

class Socket extends Events {
	constructor(){
		super();
		
		this.cli = new Events();
		this.queue = [];
		this.queue_interval = setInterval(() => {
			if(!this.ws || this.ws.readyState != 1 || !this.queue.length)return;
			this.seen = [];
			
			this.ws.send(JSON.stringify({
				i: true, // indicate this is multi-message
				d: this.queue,
			}, (key, value) => {
				if(!value)return; // optimize size
				return typeof value == 'object' && value ? !this.seen.includes(value) ? (this.seen.push(value), value) : null : value;
			}));
			
			this.queue = [];
			delete this.seen;
		}, 1000),
		
		this.on('ali', () => !document.hidden && this.send('ali'));
		
		this.cli.on('message', data => {
			data = JSON.parse(data);
			
			if(data && data.i)data.d.forEach(arr => Array.isArray(arr) ? this.emit(...arr) : console.error(arr));
			else if(Array.isArray(data))this.emit(...data);
		});
	}
	get(event, ...data){
		return new Promise((...args) => {
			var id = Math.random();
			
			this.send(event, id, ...data);
			
			this.once(id, (type, ...data) => args[type].call(this, ...data));
		});
	}
	send(...data){
		this.seen = [];
		
		if(!this.ws || this.ws.readyState != 1)this.queue.push(data);
		else this.ws.send(JSON.stringify(data, (key, value) => {
			// if(typeof value == 'undefined' || value == null)return; // optimize size
			return value != null && typeof value == 'object' && value ? !this.seen.includes(value) ? (this.seen.push(value), value) : null : value;
		}));
		
		delete this.seen;
		
		return true;
	}
	sendm(...data){
		this.seen = [];
		
		this.ws.send(JSON.stringify({
			i: true, // indicate this is multi-message
			d: data,
		}, (key, value) => {
			if(typeof value != 'number' && !value)return; // optimize size
			return typeof value == 'object'
				? !this.seen.includes(value)
					? (this.seen.push(value), value) 
						: null
						: value;
		}));
		
		delete this.seen;
	}
	connect(url){
		this.url = url;
		
		try{
			this.ws = new WebSocket(this.url);
		}catch(err){
			return this.emit('error', err);
		}
		
		this.ws.addEventListener('message', message => this.cli.emit('message', message.data));
		
		// sometimes return value different on browsers
		// using addition thing works
		
		this.ws.addEventListener('open', () => this.emit('open'));
		
		this.ws.addEventListener('close', event => this.emit('close', event.code));
	}
	reconnect(){
		if(!this.do_reconnect)return;
		
		console.debug('websocket disconnected, reconnecting in 2 seconds...');
		
		setTimeout(() => {
			console.debug('websocket disconnected, reconnecting..');
			this.connect();
		}, 2000);
	}
};

module.exports = Socket;