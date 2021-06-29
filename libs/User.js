'use strict';
var fs = require('fs'),
	dns = require('dns'),
	url = require('url'),
	path = require('path'),
	https = require('https'),
	crypto = require('crypto'),
	bcrypt = require('bcrypt'),
	constants = require('../data/constants'),
	assets = require('../data/assets'),
	Snowflake = require('./snowflake');

class User {
	static cache = new Map();
	constructor(data){
		if(typeof data != 'object')throw new TypeError('`data` is not of type `object`, recieved ' + typeof data);
		
		this.data = data;
		
		if(User.cache.has(this.id))this.data = User.cache.get(this.id);
		else User.cache.set(this.id, this.data);
		
		setTimeout(() => {
			// if(this.data)console.warn(this.id, ' was not closed in 1000 MS, was this intentional?');
		}, 1000);
	}
	close(){
		User.cache.delete(this.id);
	}
	ban(staff, reason){
		if(this.punish)throw new constants.ClassError('User is already punished.');
		
		this.punish = [ 'ban', staff, reason, Date.now() ];
		this.cases.push(this.punish);
	}
	unban(staff, reason){
		if(!this.punish || this.punish[0] != 'ban')throw new constants.ClassError('User is not banned.');
		
		this.punish = null;
		
		this.cases.push([ 'unban', staff, reason, Date.now() ]);
	}
	ipban(staff, reason){
		if(this.punish)throw new constants.ClassError('User is already punished.');
		
		this.punish = [ 'ipban', staff, reason, Date.now() ];
		this.cases.push(this.punish);
	}
	unipban(staff, reason){
		if(!this.punish || this.punish[0] != 'ipban')throw new constants.ClassError('User is not banned.');
		
		this.punish = null;
		
		this.cases.push([ 'unipban', staff, reason, Date.now() ]);
	}
	mute(staff, reason, duration){
		if(this.punish)throw new constants.ClassError('User is already punished.');
		
		this.punish = ['mute', staff, reason, Date.now(), duration];
		this.cases.push(this.punish);
	}
	unmute(staff, reason){
		if(!this.punish || this.punish[0] != 'mute')throw new constants.ClassError('User is not muted.');
		
		this.punish = null;
		
		this.cases.push([ 'unmute', staff, reason, Date.now() ]);
	}
	get_json(prop, can_null = false){
		var data = this.data[prop],
			arr = data && typeof data == 'object' ? data : data ? JSON.parse(data) : can_null ? null : [];
		
		if(Array.isArray(arr)){
			var fills = ['splice', 'push', 'shift', 'unshift'];
			
			fills.forEach(func => arr[func] = (...args) => {
				var ret = Array.prototype[func].call(arr, ...args);
				return this.set_json(prop, JSON.stringify(arr)), ret;
			});
		}
	
		return arr;
	}
	set_json(prop, value){
		return this.set_prop(prop, typeof value == 'object' && value != null ? JSON.stringify(value) : value);
	}
	set_prop(prop, value){
		this.data[prop] = value;
		this.sync();
		
		return constants.db.run(`update users set ${prop} = ? where id = ?;`, value, this.id);
	}
	// arrays
	get cases(){
		return this.get_json('cases');
	}
	set cases(value){
		this.set_json('cases', value);
	}
	get friends(){
		return this.get_json('friends');
	}
	set friends(value){
		this.set_json('friends', value);
	}
	get punish(){
		return this.get_json('punish', true);
	}
	set punish(value){
		if(this.perms.staff)throw new constants.ClassError('This user is a staff');
		
		if(value && value[0] == 'ipban'){
			constants.db.run(`insert or replace into ipbans (ip,staff,reason,time) values (?, ?, ?, ?);`, this.ip, value[1], value[2], value[3]);
			
			value = JSON.stringify(value);
		}
		
		var was_ipban = !value && this.get_json('punish') && this.get_json('punish')[0] == 'ipban';
		
		if(was_ipban)constants.db.run('delete from ipbans where ip = ?', this.ip);
		
		this.set_json('punish', value).then(() => this.sync());
	}
	async sync_punish(){
		var ban = await constants.db.get('select * from ipbans where ip = ?', this.ip),
			punish = this.get_json('punish');
		
		this.data.punish = ban ? [ 'ipban', ban.staff, ban.reason, ban.date ] : this.data.punish;
		
		return this;
	}
	async sync(){
		for(var socket of require('./Socket').clients)if(socket.user){
			if(io.user.ip == this.ip){
				var punish = io.user.punish;
				
				await io.user.sync_punish();
				
				if(io.user && io.user.id != this.id && JSON.stringify(punish) != JSON.stringify(io.user.punish))io.sync();
			}
			
			if(io.user.id == this.id)await io.sync(this);
		}
	}
	get blocked(){
		return this.get_json('blocked');
	}
	set blocked(value){
		this.set_json('blocked', value);
	}
	get incoming(){
		return this.get_json('incoming');
	}
	set incoming(value){
		this.set_json('incoming', value);
	}
	get outgoing(){
		return this.get_json('outgoing');
	}
	set outgoing(value){
		this.set_json('outgoing', value);
	}
	// end arrays
	get perm(){
		return this.data.perm;
	}
	set perm(value){
		this.set_prop('perm', value);
	}
	get perms(){
		var res = {
			member: true,
		};
		
		res[this.perm] = true;
		
		if(res.owner)res.admin = true;
		if(res.admin)res.mod = true;
		if(res.mod)res.helper = true;
		if(res.helper)res.staff = true;
		
		return res;
	}
	get signup(){
		return this.data.signup;
	}
	get laston(){
		return this.data.laston;
	}
	set laston(value){
		this.set_prop('laston', value);
	}
	get token(){
		return this.data.token;
	}
	set token(value){
		this.set_prop('token', value);
	}
	get id(){
		return this.data.id;
	}
	set id(value){
		this.set_prop('id', value);
	}
	get hash(){
		return this.data.hash;
	}
	set hash(value){
		this.set_prop('hash', value);
	}
	get email(){
		return this.data.email;
	}
	set email(value){
		this.set_prop('email', value);
	}
	get ip(){
		// 15 is maximum ipv4 length
		return this.data.ip ? this.data.ip.length > 15 ? this.data.ip.split(':').splice(0, 4).join(':') : this.data.ip : '127.0.0.1';
	}
	set ip(value){
		this.set_prop('ip', value);
	}
	get raw_ip(){
		// 15 is maximum ipv4 length
		return this.data.ip;
	}
	get discrim(){
		// .toString().padStart(6, 0)
		return this.data.discrim;
	}
	set discrim(value){
		this.set_prop('discrim', value);
	}
	get name(){
		return this.data.name || '';
	}
	set name(value){
		this.set_prop('name', value);
	}
	get avatar_url(){
		return 'https://cdn.discordapp.com/embed/avatars/' + this.avatar + '.png'
	}
	get avatar(){
		return this.data.avatar;
	}
	set avatar(value){
		this.set_prop('avatar', value);
	}
	get tag(){
		var arr = [];
		
		if(this.data.perm)arr.push('[' + this.data.perm + ']');
		
		arr.push(this.discrim.toString().padStart(6, 0));
		
		if(this.name)arr.push(this.name.substr(0, 12));
		
		return arr.join(' : ');
	}
	async json(){
		var obj = {
				perm: this.perm,
				name: this.name,
				email: this.email,
				avatar: this.avatar,
				cases: this.cases,
				discrim: this.discrim,
				id: this.id,
				punish: this.punish,
				tag: this.tag,
			},
			types = ['friends', 'incoming', 'outgoing', 'blocked'];
		
		for(var ind in types){
			var type = types[ind];
			
			obj[type] = [];
			
			for(var sub_ind = 0; sub_ind < this[type].length; sub_ind++){
				var discrim = this[type][sub_ind],
					user = await User.resolve_discrim(discrim).catch(() => false);
				
				if(!user)obj[type].push([ user.avatar_url, user.name, user.discrim, [...exports.io.clients.values()].find(io => io.user && io.user.id == user.id) ]);
			}
		}
		// avatar, name, discrim, dm_id
		
		return obj;
	}
	static bytes(max, enc){
		return new Promise((resolve, reject) => crypto.randomBytes(max, (err, buf) => err ? reject(err) : resolve(enc ? buf.toString(enc) : buf)));
	}
	static async discrim(){
		var discrim;
		
		while(true){
			discrim = ~~(Math.random() * 999999);
			if(await constants.db.get('select discrim from users where discrim = ?', discrim))continue;
			break;
		}
		
		return discrim;
	}
	static async token(){
		var token;
		
		while(true){
			token = await this.bytes(32, 'hex');
			if(await constants.db.get('select token from users where token = ?', token))continue;
			break;
		}
		
		return token;
	}
	static username(){
		var first = assets.names.first[~~(Math.random() * assets.names.first.length)],
			last = assets.names.last[~~(Math.random() * assets.names.last.length)];
		
		return first[0].toUpperCase() + first.substr(1) + ' ' + last[0].toUpperCase() + last.substr(1);
	}
	static async resolve_active_user(user){
		// user still a raw object
		var out = new this(user);
		
		await out.sync_punish();
		
		return out;
	}
	static async resolve_token(token){
		var user = await constants.db.get('select * from users where token = ?', token);
		
		if(!user)throw new constants.ClassError(JSON.stringify(token) + ' does not exist');
		
		return await this.resolve_active_user(user);
	}
	static async resolve_id(id){
		var user = await constants.db.get('select * from users where id = ?', id);
		
		if(!user)throw new constants.ClassError(JSON.stringify(idid) + ' does not exist');
		
		return await this.resolve_active_user(user);
	}
	static async resolve_discrim(discrim){
		var user = await constants.db.get('select * from users where discrim = ?', parseInt(discrim));
		
		if(!user)throw new constants.ClassError(JSON.stringify(discrim) + ' does not exist');
		
		return await this.resolve_active_user(user);
	}
	static async login(email, pass){
		var users = await constants.db.all('select * from users where email = ?', email),
			user;
		
		if(!users.length)throw { email: 'Account not found' };
		
		for(var ind in users){
			var compared = await bcrypt.compare(pass, users[ind].hash);
			
			if(compared){
				return new User(users[ind]);
				break;
			}
		}
		
		throw { email: 'Invalid credentials' };
	}
	static async email(email){
		if(typeof email != 'string')throw new constants.ClassError('Invalid email');
		
		if(await constants.db.get('select email from users where email = ?', email))throw new constants.ClassError('Email already in use');
		
		if(!(await dns.promises.lookup(email.split('@')[1]).then(() => true).catch(() => false)))throw new constants.ClassError('Invalid email');
		
		return true;
	}
	static async signup(email, pass){
		await this.email(email);
		
		var signup = Date.now(),
			hash = await bcrypt.hash(pass, 10),
			token = await this.token(),
			obj = {
				id: Snowflake.generate(),
				token: token,
				name: this.username(),
				discrim: await this.discrim(),
				signup: signup,
				laston: signup,
				avatar: ~~(Math.random() * 5),
				email: email,
				hash: hash,
			},
			ent = Object.entries(obj),
			keys = ent.map(entry => entry[0]),
			vals = ent.map(entry => entry[1]),
			inds = keys.map(x => '?').join(',');
		
		await constants.db.run(`insert or replace into users (${keys}) values (${inds});`, ...vals);
		
		return new this(obj);
	}
};

module.exports = User;