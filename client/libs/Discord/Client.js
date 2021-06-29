'use strict';

var { obv, nodes, cdn } = require('../constants.js'),
	DOM = require('../DOM'),
	Form = require('./form'),
	Message = require('./Message'),
	Content = require('./Content'),
	Emojis = require('./Emojis'),
	assets = require('../../../data/assets'),
	time = {
		second: 1000,
		minute: 1000 * 60,
		hour: 1000 * 60 * 60,
		day: 1000 * 60 * 60 * 24,
		month: 1000 * 60 * 60 * 25 * 30,
		year: 1000 * 60 * 60 * 24 * 365,
	};

class Client {
	constructor(){
		this.user = {};
		this.guilds = new Map();
		this.channels = new Map();
		this.contents = new Map();
		
		this.keys = {};
		
		window.addEventListener('keydown', event => this.keys[event.key] = true, this.key_update());
		
		window.addEventListener('keyup', event => (this.keys[event.key] = false, this.key_update()));
		
		this.emojis = new Emojis(this);
		
		this.settings = {
			show(){
				this.main.classList.add('visible');
			},
			hide(){
				this.main.classList.remove('visible');
			},
			main: DOM.add_ele('div', nodes.body, { className: 'settings' }),
			sections: {},
		};
		
		var close = DOM.add_ele('raw', this.settings.main, { html: assets.svg.close });
		close.classList.add('close');
		
		close.addEventListener('click', () => this.settings.hide());
		
		// account
		((sec = { main: DOM.add_ele('div', this.settings.main, { className: 'section' }) }) => {
			this.settings.sections.account = sec;
			
			DOM.add_ele('div', sec.main, { className: 'title', textContent: 'My Account' });
			
			sec.panel = DOM.add_ele('div', sec.main, { className: 'panel' });
			
			sec.profile = DOM.add_ele('div', sec.panel, { className: 'profile' });
			
			sec.avatar = DOM.add_ele('div', sec.profile, { className: 'avatar' });
			
			sec.avatar.addEventListener('click', () => {
				this.user.avatar = (this.user.avatar + 1 || 0) % 5;
				this.sync();
			});
			
			sec.info = DOM.add_ele('div', sec.profile, { className: 'info' });
			
			sec.name = DOM.add_ele('div', sec.info, { className: 'name' });
			
			sec.discrim = DOM.add_ele('div', sec.info, { className: 'discrim' });
			
			obv.observe(sec.avatar);
			
			sec.update = () => {
				sec.avatar.style['background-image'] = 'url(' + cdn.url('https://discord.com/embed/avatars/' + (this.user.avatar || 0) + '.png') + ')';
				
				sec.name.textContent = this.user.name;
				sec.discrim.textContent = '#' + this.user.discrim;
				
				sec.config.forEach(entry => entry.value_node.innerHTML = entry.display());
			};
			
			sec.nested = DOM.add_ele('div', sec.panel, { className: 'panel-nested' });
			
			sec.config = [{
				label: 'Username',
				title: 'Change your username',
				desc: 'Enter a new username and your existing password.',
				get: _ => this.user.name,
				display: _ => '<div class="name">' + DOM.sanatize(this.user.name) + '</div><div class="discrim">#' + this.user.discrim + '</div>',
				ent: 'name',
			},{
				label: 'Email',
				title: 'Enter an email address',
				desc: 'Enter an email address and your existing password.',
				get: _ => this.user.email,
				display: _ => DOM.sanatize(this.user.email),
				ent: 'email',
			}].map(entry => {
				entry.main = DOM.add_ele('div', sec.nested, { className: 'entry' });
				
				DOM.add_ele('div', entry.main, { className: 'label', textContent: entry.label });
				
				entry.value_node = DOM.add_ele('div', entry.main, { className: 'value', innerHTML: entry.display() });
				
				entry.edit = DOM.add_ele('button', entry.main, { className: 'button grey', textContent: 'Edit' });
				
				entry.edit.addEventListener('click', () => {
					var form = new Form(entry.title, entry.desc),
						main = new Form.Input(form, entry.label, entry.label.toLowerCase(), entry.get()),
						pass = new Form.Input(form, 'Password', 'password'),
						cancel = new Form.Button(form, 'Cancel'),
						done = new Form.Button(form, 'Done', true);
					
					form.addEventListener('submit', event => {
						event.preventDefault();
						
						io.get('user', Object.assign({}, this.user, {
							[entry.ent]: main.value,
							pass: pass.value,
						})).then(() => form.close).catch(err => form.error(err));
					});
				});
				
				return entry;
			});
			
			DOM.add_ele('div', sec.main, { className: 'title margin-16', textContent: 'Password and Authencation' });
			
			DOM.add_ele('div', sec.main, { className: 'button inline margin-16', textContent: 'Change Password' }).addEventListener('click', () => {
				var form = new Form('Change your password', 'Enter your current password and a new password.'),
					pass = new Form.Input(form, 'Current Password', 'password'),
					new_pass = new Form.Input(form, 'New Password', 'password'),
					cancel = new Form.Button(form, 'Cancel'),
					done = new Form.Button(form, 'Done', true);
				
				form.submit.then(detail => {
					detail.prevent_default();
					
					io.get('password', pass.value, new_pass.value).then(() => form.close()).catch(err => form.error(err));
				});
			});
			
			sec.update();
		})();
	}
	key_update(){
		nodes.body.classList[this.keys.Shift ? 'add' : 'remove']('shift');
	}
	process(string){
		var nodes = {},
			add_node = html => {
				var id = Math.random();
				nodes[id] = html;
				return id;
			},
			san = DOM.sanatize((string || '')
			.replace(/<a?(:.*?:)(\d*?)>/g, (match, name, id) => add_node('<img class="emoji" src=' + JSON.stringify(cdn.url('https://cdn.discordapp.com/emojis/' + id)) + ' data-name=' + JSON.stringify(name) + '></img>'))
			.replace(/\*{2}(.+?)\*{2}/g, (match, text) => add_node(`<b>${DOM.sanatize(text)}</b>`))
			.replace(/\*(.+?)\*/g, (match, text) => add_node(`<i>${DOM.sanatize(text)}</i>`))
			.replace(/__(.+?)__/g, (match, text) => add_node(`<u>${DOM.sanatize(text)}</u>`))
			.replace(/~~(.+?)~~/g, (match, text) => add_node(`<span class='strike'>${DOM.sanatize(text)}</span>`))
			.replace(/<(\w+\:\/\/\S+)\>|(https?\:\/\/\S+)/g, (match, urla, urlb) => {
				var url = urla || urlb;
				
				return add_node(`<a href=${JSON.stringify(url)}>${DOM.sanatize(url)}</a>`);
			})
			.replace(/^> (.*)$/gm, (match, text) => add_node(`<div class='quote'>${DOM.sanatize(text)}</div>`))
			.replace(/\\([^a-zA-Z0-9])/g, (match, raw) => raw));
		
		for(var id in nodes)san = san.replace(id, nodes[id]);
		
		return this.emojis.node(san);
	}
	update(){
		this.user.discrim = this.user.discrim.toString().padStart(6, 0);
		
		this.guilds.forEach(guild => guild.update());
		
		this.settings.sections.account.update();
		
		var interval;
		
		if(this.channels.has('friends'))this.friends(this.channels.get('friends'));
		else interval = setInterval(() => {
			if(this.channels.has('friends'))clearInterval(interval);
			else return;
			
			this.friends(this.channels.get('friends'));
		}, 100);
	}
	friends(friends){
		friends.pending.innerHTML = '';
		friends.friends.innerHTML = '';
		
		var types = ['incoming', 'outgoing', 'friends'];
		
		types.forEach(type => this.user[type].forEach(data => friends.user_li(type, ...data)));
		
		var pending = this.user.incoming.length + this.user.outgoing.length;
		
		friends.pending_title.textContent = pending ? 'Pending — ' + pending : '';
		friends.friends_title.textContent = this.user.friends.length ? 'All Friends — ' + this.user.friends.length : '';
		
		// profile friends id = pfid
		
		var pfid = types.map(type => this.user[type].length).join('');
		
		if(pfid != localStorage.getItem('pfid'))friends.unread();
		
		localStorage.setItem('pfid', pfid);
	}
	sync(){
		return io.send('user', this.user);
	}
	time_str(ud){
		ud = new Date(ud);
		
		return ~~ud.getUTCHours() + ' hours, ' + ~~ud.getUTCMinutes() + ' minutes, ' + ~~ud.getUTCSeconds() + ' seconds';
	}
	mute_str(mute){
		return this.time_str((mute[0] + mute[2]) - Date.now());
	}
	active_channel(){
		var val;
		
		this.channels.forEach(channel => !val && channel.active && (val = channel));
		
		return val;
	}
	timestamp(date){
		var date_now = new Date(Date.now()),
			time = new Date(date),
			time_str;
		
		switch(time.getDate()){
			case date_now.getDate():
				
				time_str = 'Today at ' + time.toLocaleString(0, { localeMatcher: 'lookup', hour: 'numeric', minute: 'numeric' });
				
				break;
			case time.getDate() == date_now.getDate() - 1:
				
				time_str =  'Yesterday at ' + time.toLocaleString(0, { localeMatcher: 'lookup', hour: 'numeric', minute: 'numeric' });
				
				break;
			default:
				time_str = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(time);
				break;
		}
		
		return time_str;
	}
	wrap(str){
		return JSON.stringify([ str ]).slice(1, -1);
	}
	handle_message(data){
		var joined,
			channel = this.channels.get(data.channel),
			message = channel ? channel.messages.last() : null;
		
		if(!channel)return console.warn('no channel with id ' + this.wrap(data.channel));
		
		var cls = channel.id + '-last',
			last_msg = parseInt(localStorage.getItem(cls));
		
		localStorage.setItem(cls, data.id);
		
		if(last_msg < parseInt(data.id) && !channel.active){
			channel.unread();
			if(!channel.guild.active)channel.guild.unread();
		}
		
		joined = !data.ref && message && message.data.author.id == data.author.id && message.data.author.name == data.author.name;
		
		if(!joined)message = new Message(this, channel, data);
		
		new Content(this, message, data, channel.can_scroll());
	}
};

module.exports = Client;