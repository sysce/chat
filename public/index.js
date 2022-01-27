/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./client/libs/DOM.js":
/*!****************************!*\
  !*** ./client/libs/DOM.js ***!
  \****************************/
/***/ ((module) => {



class DOMUtils {
	constructor(){
		this.sanatize_buffer = this.add_ele('div', document.body, { style: 'display: none' });
	}
	add_ele(node_name, parent, attributes = {}){
		var crt = this.crt_ele(node_name, attributes);
		
		if(typeof parent == 'function')this.wait_for(parent).then(data => data.appendChild(crt));
		else if(typeof parent == 'object' && parent != null && parent.appendChild)parent.appendChild(crt);
		else throw new Error('Parent is not resolvable to a DOM element');
		
		return crt;
	}
	crt_ele(node_name, attributes = {}){
		var after = {};
		
		for(let prop in attributes)if(typeof attributes[prop] == 'object' && attributes[prop] != null)after[prop] = attributes[prop], delete attributes[prop];
	
		var node;
		
		if(node_name == 'raw')node = this.crt_ele('div', { innerHTML: attributes.html }).firstChild;
		else if(node_name == 'text')node = document.createTextNode('');
		else node = document.createElement(node_name)
		
		var cls = attributes.className;
		
		if(cls){
			delete attributes.className;
			if(typeof node.setAttribute != 'function')console.error(node);
			node.setAttribute('class', cls);
		}
		
		var events = after.events;
		
		if(events){
			delete after.events;
			
			for(let event in events)node.addEventListener(event, events[event]);
		}
		
		Object.assign(node, attributes);
		
		for(let prop in after)Object.assign(node[prop], after[prop]);
		
		return node;
	}
	tree(nodes, parent = document){
		var output = {
				parent: parent,
			},
			match_container = /^\$\s+>?/g,
			match_parent = /^\^\s+>?/g;
		
		for(var label in nodes){
			var value = nodes[label];
			
			if(value instanceof Node)output[label] = value;
			else if(typeof value == 'object')output[label] = this.tree(value, output.container);
			else if(match_container.test(nodes[label])){
				if(!output.container){
					console.warn('No container is available, could not access', value);
					continue;
				}
				
				output[label] = output.container.querySelector(nodes[label].replace(match_container, ''));
			}else if(match_parent.test(nodes[label])){
				if(!output.parent){
					console.warn('No parent is available, could not access', value);
					continue;
				}
				
				output[label] = output.parent.querySelector(nodes[label].replace(match_parent, ''));
			}else{
				output[label] = document.querySelector(nodes[label]);
			}
			
			if(!output[label])console.warn('No node found, could not access', value);
		}
		
		return output;
	}
	sanatize(str){
		this.sanatize_buffer.textContent = str;
		
		var clean = this.sanatize_buffer.innerHTML;
		
		this.sanatize_buffer.innerHTML = '';
		
		return clean;
	}
	unsanatize(str){
		this.sanatize_buffer.innerHTML = str;
		var clean = this.sanatize_buffer.textContent;
		
		this.sanatize_buffer.innerHTML = '';
		
		return clean;
	}
};

module.exports = new DOMUtils();

/***/ }),

/***/ "./client/libs/Discord/Category.js":
/*!*****************************************!*\
  !*** ./client/libs/Discord/Category.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var assets = __webpack_require__(/*! ../../../data/assets */ "./data/assets.js"),
	DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js");

class Category {
	constructor(client, guild, data){
		this.channels = [];
		this.id = data[0];
		this.name = data[1];
		
		this.container = DOM.add_ele('div', guild.sidebar.channels, {
			className: 'category',
		});
		
		if(this.name){
			
			this.header = DOM.add_ele('div', this.container, {
				className: 'header',
			});
			
			this.toggle_button = DOM.add_ele('raw', this.header, { html: assets.svg.toggle2 });
			
			this.toggle_button.classList.add('toggle');
			
			this.name_node = DOM.add_ele('div', this.header, {
				textContent: this.name,
				className: 'name',
			});
			
			this.open = 1;
			
			this.header.addEventListener('click', event => {
				this.open ^= 1;
				
				this.toggle_button.style.transform = this.open  ? '' : 'rotate(-90deg)';
				this.list.style.display = this.open ? 'flex' : 'none';
			});
		}
		
		this.list = DOM.add_ele('div', this.container, {
			className: 'list',
		});
		
		guild.categories.set(this.id, this);
	}
	add_channel(channel){
		return this.channels.push(channel);
	}
};

module.exports = Category;

/***/ }),

/***/ "./client/libs/Discord/Channel.js":
/*!****************************************!*\
  !*** ./client/libs/Discord/Channel.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js"),
	assets = __webpack_require__(/*! ../../../data/assets */ "./data/assets.js"),
	{ cdn, socket } = __webpack_require__(/*! ../constants */ "./client/libs/constants.js"),
	Category = __webpack_require__(/*! ./Category */ "./client/libs/Discord/Category.js"),
	Form = __webpack_require__(/*! ./Form */ "./client/libs/Discord/Form.js"),
	Collection = __webpack_require__(/*! ./Collection */ "./client/libs/Discord/Collection.js");

class Channel {
	constructor(guild, data){
		this.messages = new Collection();
		this.contents = new Collection();
		this.client = guild.client;
		this.data = data;
		this.id = data.id;
		this.name = data.name;
		this.topic = data.topic;
		this.guild = guild;
		
		if(this.client.channels.has(data.id))return this.client.channels.get(data.id);
		
		this.guild.channels.set(data.id, this);
		this.client.channels.set(data.id, this);
		
		this.category = guild.categories.get(data.category[0]) || new Category(this.client, this.guild, data.category);
		
		this.wrapper = DOM.add_ele('div', guild.wrapper, { className: 'channel' });
		
		this.meta = {
			wrapper: DOM.add_ele('div', this.wrapper, { className: 'channel-meta' })
		};
		
		this.meta.icon = DOM.add_ele('raw', this.meta.wrapper, {
			html: this.name == 'Friends' ? assets.svg.channel.friends : this.name == 'rules' ? assets.svg.channel.rules : assets.svg.channel.normal,
		});
		
		this.meta.name = DOM.add_ele('div', this.meta.wrapper, { className: 'name', textContent: this.name });
		this.meta.desc = DOM.add_ele('div', this.meta.wrapper, { className: 'description', innerHTML: this.topic ? this.client.process(this.topic) : '' });
		
		this.meta.icon.setAttribute('class', 'icon');
		
		this.button = DOM.add_ele('div', this.category.list, { className: 'channel-menu' });
		
		if(this.data.dm)DOM.add_ele('div', this.button, { className: 'icon image', style: 'background-image:url(' + this.client.wrap(this.data.dm) + ')' });
		else DOM.add_ele('raw', this.button, { html: this.meta.icon.outerHTML });
		
		DOM.add_ele('div', this.button, { className: 'label', textContent: this.name });
		
		
		if(this.data.dm){
			this.close = DOM.add_ele('raw', this.button, { html: assets.svg.close_dm });
			
			this.close.classList.add('close');
			
			this.close.addEventListener('click', () => {
				socket.send('dm_close', this.id);
				
				this.delete();
			});
		}
		
		this.button.addEventListener('click', event => this.show());
		
		this.msg_list = DOM.add_ele('div', this.wrapper, { className: 'message-list' });
		
		if(this.name == 'Friends'){
			this.update = this.fetch_messages = () => {};
			
			this.user_li = (type, avatar, name, discrim, online) => {
				var con = DOM.add_ele('div', type == 'friends' ? this.friends : this.pending, { className: 'user-li' });
				
				DOM.add_ele('div', con, { className: 'avatar', style: 'background-image:url(' + cdn.url(avatar) + ')' });
				
				var info_con = DOM.add_ele('div', con, { className: 'info' });
				
				DOM.add_ele('div', DOM.add_ele('div', info_con, { className: 'name', textContent: name }), { className: 'discrim', textContent: '#' + discrim.toString().padStart(6, 0) });
				
				DOM.add_ele('div', info_con, { className: 'desc', textContent: type == 'friends' ? online ? 'Online' : 'Offline' : type[0].toUpperCase() + type.substr(1) + ' Friend Request' });
				
				var actions = DOM.add_ele('div', con, { className: 'actions' });
				
				if(type == 'friends'){
					var dm = DOM.add_ele('raw', actions, { html: assets.svg.message });
					dm.classList.add('action');
					dm.addEventListener('click', () => socket.get('dm', discrim).then(id => {
						if(this.client.channels.has(id))this.client.channels.get(id).show();
					}));
				}else if(type == 'incoming'){
					var accept = DOM.add_ele('raw', actions, { html: assets.svg.accept });
					accept.classList.add('action', 'accept');
					accept.addEventListener('click', () => socket.send('friend', 'accept', discrim));
				}
				
				var close = DOM.add_ele('raw', actions, { html: assets.svg.close });
				close.classList.add('action', 'close');
				close.addEventListener('click', () => socket.send('friend', 'remove', discrim));
			};
			
			DOM.add_ele('button', this.msg_list, { className: 'button thin', textContent: 'Send friend request' }).addEventListener('click', () => {
				var form = new Form('Send a friend request'),
					id = new Form.Input(form, 'User ID ( 123456 )'),
					close = new Form.Button(form, 'Cancel'),
					send = new Form.Button(form, 'Send', true);
				
				form.submit.then(() => socket.send('friend', 'add', parseInt(id.value)) + form.close());
			});
			
			this.pending_title = DOM.add_ele('div', this.msg_list, { className: 'friends-title' });
			
			this.pending = DOM.add_ele('div', this.msg_list, { className: 'friends-list' });
			
			this.friends_title = DOM.add_ele('div', this.msg_list, { className: 'friends-title' });
			
			this.friends = DOM.add_ele('div', this.msg_list, { className: 'friends-list' });
			
			return;
		}
		
		this.input = {
			area: DOM.add_ele('div', this.wrapper, { className: 'input-area' }),
		};
		
		this.input.form = DOM.add_ele('form', this.input.area, { className: 'input-form' });
		
		this.input.form.addEventListener('submit', event => {
			event.preventDefault();
			
			this.send(this.input.bar.value);
			
			this.input.bar.value = '';
		});
		
		this.input.bar = DOM.add_ele('input', this.input.form, {
			className: 'input-bar',
			type: 'text',
			autocomplete: 'off',
			placeholder: !this.client.status ? data.perms.SEND_MESSAGES ? 'Message #' + this.name : 'You do not have permission to send messages in this channel.' : this.client.status,
			disabled: this.client.status || !data.perms.SEND_MESSAGES,
		});
		
		this.emoji_toggle = DOM.add_ele('div', this.input.form, { className: 'emoji-toggle' });
		
		this.emoji_toggle.addEventListener('click', () => this.client.emojis.toggle());
		
		this.update();
		
		this.typing_box = DOM.add_ele('div', this.input.form, { className: 'typing-box' });
		
		DOM.add_ele('s', this.typing_box, { className: 's' });
		DOM.add_ele('s', this.typing_box, { className: 's' });
		DOM.add_ele('s', this.typing_box, { className: 's' });
		
		this.typers = DOM.add_ele('div', this.typing_box, { className: 'typers' });
		
		this.hide();
	}
	delete(){
		this.hide();
		
		this.button.remove();
		this.wrapper.remove();
		this.guild.channels.delete(this.id);
		this.client.channels.delete(this.id);
		
		this.messages.forEach(message => message.delete());
	}
	update(data){
		if(data)this.data = data;
		
		this.emoji_toggle.style.display = 'none';
		
		if(!this.data.perms.SEND_MESSAGES || this.client.user.locked)return Object.assign(this.input.bar, {
			value: 'You do not have permission to send messages in this channel.',
			disabled: true,
		});
		
		if(!this.data.dm){
			if(this.client.user.punish)return Object.assign(this.input.bar, {
				value: 'You are ' + (this.client.user.punish[0] == 'mute' ? 'muted' : 'banned') + ', ' + (this.client.user.punish[2] || 'No reason specified'),
				disabled: true,
			});
			
			if(this.client.locked && !this.data.dm)return Object.assign(this.input.bar, {
				value: 'You do not have permission to send messages in this channel.',
				disabled: true,
			});
		}
		
		Object.assign(this.input.bar, {
			placeholder: 'Message ' + (this.data.dm ? '@' : '#') + this.name,
			value: '',
			disabled: false,
		});
		
		this.emoji_toggle.style.display = this.active ? 'block' : 'none';
	}
	can_scroll(){
		return this.scroll_anyways || this.msg_list.scrollTop >= this.msg_list.scrollHeight - this.msg_list.offsetHeight - 300;
	}
	scroll(){
		return this.msg_list.scrollTop = this.msg_list.scrollHeight
	}
	send(content){
		if(!(content + '').trim().length)return;
		
		for(let [ key, val ] of this.client.emojis.uni_flat)content = content.replace(val, ':' + key + ':');
		
		socket.send('message', 'send', this.id, content, '');
	}
	clear(){
		for(let [ id, message ] of this.messages)message.delete();
	}
	async fetch_messages(){
		this.clear();
		
		var messages = await socket.get('messages', this.id);
		
		// indicate that the message list should be at the bottom regardless
		this.scroll_anyways = true;
		
		for(let message of messages)this.client.handle_message(message);
		
		this.scroll_anyways = false;
	}
	read(){
		this.button.classList.remove('unread');
	}
	unread(){
		this.button.classList.add('unread');
	}
	show(show_guild = true){
		if(this.active)return;
		
		this.button.classList.add('selected');
		this.read();
		
		this.guild.channels.forEach(channel => channel != this && channel.hide());
		
		this.guild.last_channel = this.id;
		
		this.client.last_channel = this.id;
		
		this.active = true;
		
		this.msg_list.style.display = 'block';
		this.wrapper.style.display = 'flex';
		
		// this.messages.forEach(message => message.delete());
		
		this.fetch_messages();
		
		this.update();
		if(show_guild)this.guild.show(false);
	}
	hide(){
		if(!this.active)return;
		
		this.active = false;
		
		this.clear();
		
		this.button.classList.remove('selected');
		
		this.msg_list.style.display = 'none';
		this.wrapper.style.display = 'none';
		// crucial to unload messages
		// this.messages.forEach(message => message.delete());
		
		this.client.emojis.hide(this.emoji_toggle);
	}
};

module.exports = Channel;

/***/ }),

/***/ "./client/libs/Discord/Client.js":
/*!***************************************!*\
  !*** ./client/libs/Discord/Client.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var { obv, nodes, cdn } = __webpack_require__(/*! ../constants.js */ "./client/libs/constants.js"),
	DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js"),
	Form = __webpack_require__(/*! ./form */ "./client/libs/Discord/form.js"),
	Message = __webpack_require__(/*! ./Message */ "./client/libs/Discord/Message.js"),
	Content = __webpack_require__(/*! ./Content */ "./client/libs/Discord/Content.js"),
	Emojis = __webpack_require__(/*! ./Emojis */ "./client/libs/Discord/Emojis.js"),
	assets = __webpack_require__(/*! ../../../data/assets */ "./data/assets.js"),
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

/***/ }),

/***/ "./client/libs/Discord/Collection.js":
/*!*******************************************!*\
  !*** ./client/libs/Discord/Collection.js ***!
  \*******************************************/
/***/ ((module) => {



class Collection extends Map {
	first(){
		return [...this.values()][0];
	}
	last(){
		var values = [...this.values()];
		
		return values[values.length - 1];
	}
}

module.exports = Collection;

/***/ }),

/***/ "./client/libs/Discord/Content.js":
/*!****************************************!*\
  !*** ./client/libs/Discord/Content.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js"),
	{ socket, obv, cdn } = __webpack_require__(/*! ../constants */ "./client/libs/constants.js"),
	assets = __webpack_require__(/*! ../../../data/assets */ "./data/assets.js"),
	ins_node = (data, pend) => {
		var id = Math.random();
		
		pend.push([ Math.random(), data ]);
		
		return '<div data-uuid="' + Math.random() + '"></div>';
	};

class Content {
	// attachments value for replies
	constructor(client, message, data, scroll){
		this.message = message;
		this.channel = message.channel;
		this.client = message.client;
		this.data = data || message.data;
		this.content = DOM.add_ele('div', this.data.reference ? message.reference : message.node, { className: 'content' + (this.data.reference ? ' reference' : '') });
		
		// if(!this.channel.active)this.channel.unread(), this.channel.update();
		
		this.message.contents.set(this.data.id, this);
		this.channel.contents.set(this.data.id, this);
		
		this.construct(scroll, this.data);
	}
	delete(sync, delete_content){
		if(delete_content){
			var message_content = this.content.parentNode.querySelectorAll('.content:not(.reference)');
			
			if(message_content.length == 1)this.content.parentNode.remove();
			else this.content.remove();
			
			this.message.contents.delete(this.data.id);
			this.channel.contents.delete(this.data.id);
		}
		
		if(sync)socket.send('message', 'delete', this.channel.id, '', this.data.id);
	}
	async attach(attach, scroll){
		var url = new URL(attach.proxyURL),
			headers = await socket.get('headers', cdn.resolve_index(url.hostname), url.pathname),
			embed_container = DOM.add_ele('div', this.content, { className: 'thumbnail' }),
			video_reg = /.*?\.(mp4||webm|mkv|flv|fv4|vob|ogg|ogv|gif|gifv|mng|avi|mts|m2ts|ts|mov|qt|wmv|yuv|asf|amv|m4p|m4v|mpg|mp2|mpeg|mpe|mpv|drc)(?:$|\?.*)/i,
			content_type = headers['content-type'];
		
		switch((content_type || 'image').split('/')[0]){
			case'image':
				
				var img = DOM.add_ele('img', embed_container, {
					src: cdn.url(attach.proxyURL),
					width: attach.width + 'px',
					height: attach.height + 'px',
					width: attach.width,
					height: attach.height,
				});
				
				obv.observe(img);
				
				img.addEventListener('load', () => scroll && this.channel.scroll());
				
				break
			case'video':
				
				var nw = attach.width - 100,
					nh = attach.height - 100,
					source = DOM.add_ele('source', DOM.add_ele('video', embed_container, {
						src: cdn.url(attach.proxyURL),
						width: attach.width,
						height: attach.height,
						controls: 'true',
					}), {
						type: content_type,
						src: cdn.url(attach.proxyURL),
					});
				
				obv.observe(source);
				
				source.addEventListener('load', () => scroll && this.channel.scroll());
				
				break
		}
		
		if(scroll)this.channel.scroll();
	}
	embed(embed, scroll){
		if(!embed)return;
		
		switch(embed.type){
			case'image':
			case'gifv':
				
				this.attach(embed, scroll);
				
				break
			case'rich':
				if(!embed.title && !embed.description && !embed.fields.length && embed.thumbnail)return this.attach(embed.thumbnail);
				
				var emb = {
					wrapper: DOM.add_ele('div', this.content, { className: 'rich-embed' }),
				};
				
				if(embed.color)emb.wrapper.style['border-color'] = '#' + embed.color.toString(16);
				
				if(embed.author){
					var author = DOM.add_ele('div', emb.wrapper, {
						className: 'author',
					});
					
					if(embed.author.icon_url)DOM.add_ele('img', author, {
						className: 'icon',
						src: embed.author.icon_url,
					});
					
					if(embed.author.name)DOM.add_ele('div', author, {
						className: 'name',
						innerHTML: this.client.process(embed.author.name),
					});
				}
				
				if(embed.title)emb.title = DOM.add_ele('div', emb.wrapper, {
					className: 'title',
					innerHTML: this.client.process(embed.title),
				});
				
				if(embed.url && embed.title)emb.title.classList.add('link'), emb.title.addEventListener('click', () => window.open(embed.url));
				
				if(embed.description)DOM.add_ele('div', emb.wrapper, {
					className: 'description',
					innerHTML: this.client.process(embed.description),
				});
				
				if(embed.thumbnail){
					emb.thumb_wrapper = DOM.add_ele('div', emb.wrapper, { className: 'thumbnail' });
					
					emb.thumb = DOM.add_ele('img', emb.thumb_wrapper, {
						src: cdn.url(embed.thumbnail.proxyURL),
						width: embed.thumbnail.width,
						height: embed.thumbnail.height,
					});
				}
				
				if(embed.footer){
					var footer = DOM.add_ele('div', emb.wrapper, {
						className: 'footer',
					});
					
					if(embed.footer.icon_url)DOM.add_ele('img', footer, {
						className: 'icon',
						src: embed.footer.icon_url
					});
					
					if(embed.footer.text)DOM.add_ele('div', footer, {
						className: 'name',
						innerHTML: this.client.process(embed.footer.text),
					});
				}
				
				if(embed.fields){
					var fields = DOM.add_ele('div', emb.wrapper, {
							className: 'fields',
						}),
						sorted = [];
					
					embed.fields.forEach(field => {
						if(sorted.last && sorted.last.inline == field.inline)sorted.last.values.push(field);
						else sorted.push({ inline: field.inline, values: [ field ] });
					});
					
					sorted.forEach(data => {
						var container = DOM.add_ele('div', fields, { className: 'fields-sep' + (data.inline ? ' inline' : '') });
						
						data.values.forEach(field => {
							var cont = DOM.add_ele('div', container, { className: 'field' });
							
							DOM.add_ele('div', cont, { innerHTML: this.client.process(field.name), className: 'name' });
							
							DOM.add_ele('div', cont, { innerHTML: this.client.process(field.value), className: 'value' });
						});
					});
				}
				
				if(scroll)this.channel.scroll();
				
				emb.wrapper.querySelectorAll('img').forEach(node => node.addEventListener('load', () => scroll && this.channel.scroll()));
				
				break;
		}
	}
	add_options(){
		if(this.data.reference)return;
		
		// add ... menu for all messages soon
		this.opts = DOM.add_ele('div', this.content, { className: 'options' });
		
		// add options if only sent by client
		if(this.data.author.name == this.client.user.tag && this.data.author.bot){
			var edit = DOM.add_ele('raw', this.opts, { html: assets.svg.options.edit });
			edit.classList.add('option');
			edit.addEventListener('click', () => this.edit_ui());
		}
		
		if(this.data.author.name == this.client.user.tag && this.data.author.bot || this.client.user.perm){
			var deletee = DOM.add_ele('raw', this.opts, { html: assets.svg.options.delete });
			
			deletee.classList.add('option');
			deletee.addEventListener('click', () => this.delete(true, false));
		}
	}
	reactions(data){
		var scroll = this.channel.can_scroll(),
			reaction_tray = this.content.querySelector('.reaction-tray') || DOM.add_ele('div', this.content, { className: 'reaction-tray' });
		
		reaction_tray.innerHTML = '';
		
		data.forEach(reaction => {
			var react = DOM.add_ele('div', reaction_tray, { className: 'reaction' }),
				parsed = this.client.emojis.link(reaction.name);
			
			(parsed != reaction.name ? DOM.add_ele('img', react, { className: 'reaction-emoji', src: parsed }) : DOM.add_ele('img', react, { className: 'reaction-emoji', src: cdn.url('https://cdn.discordapp.com/emojis/' + reaction.id) })).dataset.name = ':' + reaction.name + ':';
			
			DOM.add_ele('div', react, { className: 'reaction-count', innerHTML: reaction.count });
		});
		
		if(scroll)this.channel.scroll();
	}
	construct(scroll, data){
		if(data)this.data = data;
		
		var pend = [];
		
		this.content.innerHTML = this.client.process(this.data.content).replace(/&lt;@?([@#]|&amp;)!?(\d+)&gt;/g, (match, typer, id) => {
			var mention = this.data.mentions[typer == '&amp;' ? 0 : typer == '#' ? 2 : 1].find(mention => mention[0] == id),
				rgb = mention && mention[2] ? [parseInt(mention[2].substr(0, 2), 16), parseInt(mention[2].substr(2, 2), 16), parseInt(mention[2].substr(4, 2), 16)].join(',') : '';
			
			if(!mention)return;
			
			return ins_node({
				className: 'mention interactive' + (typer == '&amp;' ? ' color' : ''),
				textContent: (typer == '&amp;' ? '@' : typer) + mention[1],
				init: node => node.addEventListener('click', () => {
					if(!this.client.channels.has(mention[0]))return;
					
					this.client.channels.get(mention[0]).show();
				}),
				style: mention[2] ? '--color:' + rgb : '',
			}, pend);
		}).replace(/(\|{2})([\s\S]*?)\1/g, (m, s, text, node) => ins_node({
			className: 'spoiler',
			innerHTML: text,
			init: node => node.addEventListener('click', () => node.classList.add('clicked')),
		}, pend));
		
		this.add_options();
		
		pend.forEach(data => {
			var found = this.content.querySelector('[data-uuid="' + data[0] + '"]');
			
			if(found){
				var init = data[1].init;
				
				delete data[1].init;
				
				init(Object.assign(found, data[1]));
			}
		});
		
		this.content.querySelectorAll('.emoji').forEach(node => node.className = this.content.textContent.trim().length == 0 && !this.data.reference ? 'emoji large' : 'emoji');
		
		if(this.data.edited)DOM.add_ele('div', this.content, { className: 'edited', innerHTML: '(edited)' });
		
		if(!this.data.reference){
			this.data.attachments.forEach(attach => this.attach(attach, scroll));
			this.data.embeds.forEach(embed => this.embed(embed, scroll));
			this.reactions(this.data.reactions);
		}else if(this.data.attachments.length || this.data.embeds.length){
			DOM.add_ele('div', this.content, { className: 'attachment-message', innerHTML: 'Click to see attachment' });
			DOM.add_ele('raw', this.content, { html: '<svg class="attachment-image" width="64" height="64" viewBox="0 0 64 64"><path fill="currentColor" d="M56 50.6667V13.3333C56 10.4 53.6 8 50.6667 8H13.3333C10.4 8 8 10.4 8 13.3333V50.6667C8 53.6 10.4 56 13.3333 56H50.6667C53.6 56 56 53.6 56 50.6667ZM22.6667 36L29.3333 44.0267L38.6667 32L50.6667 48H13.3333L22.6667 36Z"></path></svg>' });
		}
		
		if(scroll)this.channel.scroll();
	}
	edit_ui(){
		if(this.data.reference)return;
		
		this.input = {
			form: DOM.add_ele('form', this.content.parentNode, { className: 'input-form' }),
		};
		
		this.input.bar = DOM.add_ele('input', this.input.form, {
			className: 'input-bar',
			type: 'text',
			autocomplete: 'off',
			placeholder: '',
			maxlength: 200,
		});
		
		this.input.form.addEventListener('submit', event => {
			event.preventDefault();
			
			this.stop_edit_ui();
		});
		
		this.content.classList.add('editing');
		this.input.form.classList.add('editing');
		
		this.input.bar.value = this.data.content;
		this.input.bar.focus();
	}
	stop_edit_ui(){
		if(this.data.reference)return;
		
		this.content.classList.remove('editing');
		
		socket.send('message', 'edit', this.channel.id, this.input.bar.value, this.data.id);
		
		this.input.bar.remove();
		this.input.form.remove();
		
		delete this.input;
	}
};

module.exports = Content;

/***/ }),

/***/ "./client/libs/Discord/Emojis.js":
/*!***************************************!*\
  !*** ./client/libs/Discord/Emojis.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js"),
	assets = __webpack_require__(/*! ../../../data/assets */ "./data/assets.js"),
	Events = __webpack_require__(/*! ../../../libs/Events */ "./libs/Events.js"),
	{ obv, nodes, cdn } = __webpack_require__(/*! ../constants */ "./client/libs/constants.js");

class Emojis extends Events {
	constructor(client){
		super();
		
		this.regex = /\\?(?:(?:\ud83d\udc68\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffc-\udfff]|\ud83d\udc68\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffd-\udfff]|\ud83d\udc68\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffc\udffe\udfff]|\ud83d\udc68\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffd\udfff]|\ud83d\udc68\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffe]|\ud83d\udc69\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffc-\udfff]|\ud83d\udc69\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffc-\udfff]|\ud83d\udc69\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffd-\udfff]|\ud83d\udc69\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb\udffd-\udfff]|\ud83d\udc69\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffc\udffe\udfff]|\ud83d\udc69\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb\udffc\udffe\udfff]|\ud83d\udc69\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffd\udfff]|\ud83d\udc69\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb-\udffd\udfff]|\ud83d\udc69\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffe]|\ud83d\udc69\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb-\udffe]|\ud83e\uddd1\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\u200d\ud83e\udd1d\u200d\ud83e\uddd1|\ud83d\udc6b\ud83c[\udffb-\udfff]|\ud83d\udc6c\ud83c[\udffb-\udfff]|\ud83d\udc6d\ud83c[\udffb-\udfff]|\ud83d[\udc6b-\udc6d])|(?:\ud83d[\udc68\udc69]|\ud83e\uddd1)(?:\ud83c[\udffb-\udfff])?\u200d(?:\u2695\ufe0f|\u2696\ufe0f|\u2708\ufe0f|\ud83c[\udf3e\udf73\udf7c\udf84\udf93\udfa4\udfa8\udfeb\udfed]|\ud83d[\udcbb\udcbc\udd27\udd2c\ude80\ude92]|\ud83e[\uddaf-\uddb3\uddbc\uddbd])|(?:\ud83c[\udfcb\udfcc]|\ud83d[\udd74\udd75]|\u26f9)((?:\ud83c[\udffb-\udfff]|\ufe0f)\u200d[\u2640\u2642]\ufe0f)|(?:\ud83c[\udfc3\udfc4\udfca]|\ud83d[\udc6e\udc70\udc71\udc73\udc77\udc81\udc82\udc86\udc87\ude45-\ude47\ude4b\ude4d\ude4e\udea3\udeb4-\udeb6]|\ud83e[\udd26\udd35\udd37-\udd39\udd3d\udd3e\uddb8\uddb9\uddcd-\uddcf\uddd6-\udddd])(?:\ud83c[\udffb-\udfff])?\u200d[\u2640\u2642]\ufe0f|(?:\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83c\udff3\ufe0f\u200d\u26a7\ufe0f|\ud83c\udff3\ufe0f\u200d\ud83c\udf08|\ud83c\udff4\u200d\u2620\ufe0f|\ud83d\udc15\u200d\ud83e\uddba|\ud83d\udc3b\u200d\u2744\ufe0f|\ud83d\udc41\u200d\ud83d\udde8|\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc6f\u200d\u2640\ufe0f|\ud83d\udc6f\u200d\u2642\ufe0f|\ud83e\udd3c\u200d\u2640\ufe0f|\ud83e\udd3c\u200d\u2642\ufe0f|\ud83e\uddde\u200d\u2640\ufe0f|\ud83e\uddde\u200d\u2642\ufe0f|\ud83e\udddf\u200d\u2640\ufe0f|\ud83e\udddf\u200d\u2642\ufe0f|\ud83d\udc08\u200d\u2b1b)|[#*0-9]\ufe0f?\u20e3|(?:[©®\u2122\u265f]\ufe0f)|(?:\ud83c[\udc04\udd70\udd71\udd7e\udd7f\ude02\ude1a\ude2f\ude37\udf21\udf24-\udf2c\udf36\udf7d\udf96\udf97\udf99-\udf9b\udf9e\udf9f\udfcd\udfce\udfd4-\udfdf\udff3\udff5\udff7]|\ud83d[\udc3f\udc41\udcfd\udd49\udd4a\udd6f\udd70\udd73\udd76-\udd79\udd87\udd8a-\udd8d\udda5\udda8\uddb1\uddb2\uddbc\uddc2-\uddc4\uddd1-\uddd3\udddc-\uddde\udde1\udde3\udde8\uddef\uddf3\uddfa\udecb\udecd-\udecf\udee0-\udee5\udee9\udef0\udef3]|[\u203c\u2049\u2139\u2194-\u2199\u21a9\u21aa\u231a\u231b\u2328\u23cf\u23ed-\u23ef\u23f1\u23f2\u23f8-\u23fa\u24c2\u25aa\u25ab\u25b6\u25c0\u25fb-\u25fe\u2600-\u2604\u260e\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262a\u262e\u262f\u2638-\u263a\u2640\u2642\u2648-\u2653\u2660\u2663\u2665\u2666\u2668\u267b\u267f\u2692-\u2697\u2699\u269b\u269c\u26a0\u26a1\u26a7\u26aa\u26ab\u26b0\u26b1\u26bd\u26be\u26c4\u26c5\u26c8\u26cf\u26d1\u26d3\u26d4\u26e9\u26ea\u26f0-\u26f5\u26f8\u26fa\u26fd\u2702\u2708\u2709\u270f\u2712\u2714\u2716\u271d\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u2764\u27a1\u2934\u2935\u2b05-\u2b07\u2b1b\u2b1c\u2b50\u2b55\u3030\u303d\u3297\u3299])(?:\ufe0f|(?!\ufe0e))|(?:(?:\ud83c[\udfcb\udfcc]|\ud83d[\udd74\udd75\udd90]|[\u261d\u26f7\u26f9\u270c\u270d])(?:\ufe0f|(?!\ufe0e))|(?:\ud83c[\udf85\udfc2-\udfc4\udfc7\udfca]|\ud83d[\udc42\udc43\udc46-\udc50\udc66-\udc69\udc6e\udc70-\udc78\udc7c\udc81-\udc83\udc85-\udc87\udcaa\udd7a\udd95\udd96\ude45-\ude47\ude4b-\ude4f\udea3\udeb4-\udeb6\udec0\udecc]|\ud83e[\udd0c\udd0f\udd18-\udd1c\udd1e\udd1f\udd26\udd30-\udd39\udd3d\udd3e\udd77\uddb5\uddb6\uddb8\uddb9\uddbb\uddcd-\uddcf\uddd1-\udddd]|[\u270a\u270b]))(?:\ud83c[\udffb-\udfff])?|(?:\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc65\udb40\udc6e\udb40\udc67\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc73\udb40\udc63\udb40\udc74\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc77\udb40\udc6c\udb40\udc73\udb40\udc7f|\ud83c\udde6\ud83c[\udde8-\uddec\uddee\uddf1\uddf2\uddf4\uddf6-\uddfa\uddfc\uddfd\uddff]|\ud83c\udde7\ud83c[\udde6\udde7\udde9-\uddef\uddf1-\uddf4\uddf6-\uddf9\uddfb\uddfc\uddfe\uddff]|\ud83c\udde8\ud83c[\udde6\udde8\udde9\uddeb-\uddee\uddf0-\uddf5\uddf7\uddfa-\uddff]|\ud83c\udde9\ud83c[\uddea\uddec\uddef\uddf0\uddf2\uddf4\uddff]|\ud83c\uddea\ud83c[\udde6\udde8\uddea\uddec\udded\uddf7-\uddfa]|\ud83c\uddeb\ud83c[\uddee-\uddf0\uddf2\uddf4\uddf7]|\ud83c\uddec\ud83c[\udde6\udde7\udde9-\uddee\uddf1-\uddf3\uddf5-\uddfa\uddfc\uddfe]|\ud83c\udded\ud83c[\uddf0\uddf2\uddf3\uddf7\uddf9\uddfa]|\ud83c\uddee\ud83c[\udde8-\uddea\uddf1-\uddf4\uddf6-\uddf9]|\ud83c\uddef\ud83c[\uddea\uddf2\uddf4\uddf5]|\ud83c\uddf0\ud83c[\uddea\uddec-\uddee\uddf2\uddf3\uddf5\uddf7\uddfc\uddfe\uddff]|\ud83c\uddf1\ud83c[\udde6-\udde8\uddee\uddf0\uddf7-\uddfb\uddfe]|\ud83c\uddf2\ud83c[\udde6\udde8-\udded\uddf0-\uddff]|\ud83c\uddf3\ud83c[\udde6\udde8\uddea-\uddec\uddee\uddf1\uddf4\uddf5\uddf7\uddfa\uddff]|\ud83c\uddf4\ud83c\uddf2|\ud83c\uddf5\ud83c[\udde6\uddea-\udded\uddf0-\uddf3\uddf7-\uddf9\uddfc\uddfe]|\ud83c\uddf6\ud83c\udde6|\ud83c\uddf7\ud83c[\uddea\uddf4\uddf8\uddfa\uddfc]|\ud83c\uddf8\ud83c[\udde6-\uddea\uddec-\uddf4\uddf7-\uddf9\uddfb\uddfd-\uddff]|\ud83c\uddf9\ud83c[\udde6\udde8\udde9\uddeb-\udded\uddef-\uddf4\uddf7\uddf9\uddfb\uddfc\uddff]|\ud83c\uddfa\ud83c[\udde6\uddec\uddf2\uddf3\uddf8\uddfe\uddff]|\ud83c\uddfb\ud83c[\udde6\udde8\uddea\uddec\uddee\uddf3\uddfa]|\ud83c\uddfc\ud83c[\uddeb\uddf8]|\ud83c\uddfd\ud83c\uddf0|\ud83c\uddfe\ud83c[\uddea\uddf9]|\ud83c\uddff\ud83c[\udde6\uddf2\uddfc]|\ud83c[\udccf\udd8e\udd91-\udd9a\udde6-\uddff\ude01\ude32-\ude36\ude38-\ude3a\ude50\ude51\udf00-\udf20\udf2d-\udf35\udf37-\udf7c\udf7e-\udf84\udf86-\udf93\udfa0-\udfc1\udfc5\udfc6\udfc8\udfc9\udfcf-\udfd3\udfe0-\udff0\udff4\udff8-\udfff]|\ud83d[\udc00-\udc3e\udc40\udc44\udc45\udc51-\udc65\udc6a\udc6f\udc79-\udc7b\udc7d-\udc80\udc84\udc88-\udca9\udcab-\udcfc\udcff-\udd3d\udd4b-\udd4e\udd50-\udd67\udda4\uddfb-\ude44\ude48-\ude4a\ude80-\udea2\udea4-\udeb3\udeb7-\udebf\udec1-\udec5\uded0-\uded2\uded5-\uded7\udeeb\udeec\udef4-\udefc\udfe0-\udfeb]|\ud83e[\udd0d\udd0e\udd10-\udd17\udd1d\udd20-\udd25\udd27-\udd2f\udd3a\udd3c\udd3f-\udd45\udd47-\udd76\udd78\udd7a-\uddb4\uddb7\uddba\uddbc-\uddcb\uddd0\uddde-\uddff\ude70-\ude74\ude78-\ude7a\ude80-\ude86\ude90-\udea8\udeb0-\udeb6\udec0-\udec2\uded0-\uded6]|[\u23e9-\u23ec\u23f0\u23f3\u267e\u26ce\u2705\u2728\u274c\u274e\u2753-\u2755\u2795-\u2797\u27b0\u27bf\ue50a])|\ufe0f)/g;
		
		this.client = client;
		this.uni_flat = Object.entries(assets.emojis).flatMap(([ key, val ]) => Object.entries(val).map(([ key, val ]) => [ key, String.fromCodePoint(...val) ])).filter(([ key, val ]) => val.match(this.regex));
		this.uni_obj = Object.fromEntries(this.uni_flat);
		
		this.client = client;
		this.wrapper = DOM.add_ele('div', nodes.body, { className: 'emoji-menu' });
		this.open = false;
		
		this.input = DOM.add_ele('input', this.wrapper, {
			type: 'text',
			className: 'search',
			placeholder: 'Find the perfect emoji',
		});
		
		this.search_icon = DOM.add_ele('raw', this.wrapper, { html: assets.svg.emoji_search });
		this.list = DOM.add_ele('div', this.wrapper, { className: 'emoji-list' });
		
		Object.entries(assets.emojis).sort((c, pc) => pc[0] == 'people' ? 1 : -1).forEach(data => {
			var cate = DOM.add_ele('div', this.list, { className: 'category' }),
				header = DOM.add_ele('div', cate, { className: 'header' }),
				list = DOM.add_ele('div', cate, { className: 'list' });
			
			DOM.add_ele('div', header, { className: 'name', innerHTML: data[0][0].toUpperCase() + data[0].slice(1) });
			
			DOM.add_ele('raw', header, { html: assets.svg.toggle, className: 'toggle' });
	
			header.addEventListener('click', event => cate.dataset.open ^= 1);
			
			Object.entries(data[1]).forEach(data => {
				var emoji = String.fromCodePoint(...data[1]),
					emoji_item = DOM.add_ele('img', list, { alt: data[0], className: 'item' })
				
				emoji_item.dataset.src = this.link(emoji);
				emoji_item.dataset.emoji = data[0];
				
				obv.observe(emoji_item);
				
				emoji_item.addEventListener('mouseover', () => this.info.focus(data[0], emoji_item.dataset.src));
				
				emoji_item.addEventListener('click', () => {
					this.hide();
					this.input.value = '';
					if(this.client.active_channel())this.client.active_channel().input.bar.focus(), this.client.active_channel().input.bar.value += emoji;
					this.open = false;
				});
				
			});
		});
		
		this.info = {
			wrapper: DOM.add_ele('div', this.wrapper, { className: 'info' }),
			focus(name, src){
				this.emoji.src = src;
				this.description.textContent = ':' + name + ':';
			},
		}
		
		this.info.emoji = DOM.add_ele('img', this.info.wrapper, { className: 'display-item' });
		this.info.description = DOM.add_ele('div', this.info.wrapper, { className: 'description' });
		
		this.info.focus('grinning', this.link(this.uni_obj.grinning));
		
		document.addEventListener('mousedown', event => {
			if(event.target.className != 'toggle' && !this.wrapper.contains(event.target))this.hide();
		});
		
		this.input.addEventListener('keyup', () => this.list.querySelectorAll('.item').forEach(emoji => emoji.style.display = (!this.input.value || emoji.getAttribute('data-emoji').includes(this.input.value)) ? 'block' : 'none'));
	}
	toggle(){
		(this.open ^= 1) ? this.show() : this.hide();
		
		if(this.open){
			this.list.querySelectorAll('.item').forEach(emoji => emoji.style.display = 'block');
			this.input.value = '';
			this.input.focus();
		}
	}
	show(){
		this.wrapper.dataset.open = this.open = true;
	}
	hide(toggle){
		if(toggle)toggle.style.display = 'none';
		this.wrapper.dataset.open = this.open = false;
	}
	link(str){
		return this.process(str, str => cdn.url('https://twemoji.maxcdn.com/v/13.0.1/72x72/' + str + '.png'));
	}
	node(str){
		return str.replace(this.regex, match => match.startsWith('\\') ? match : '<img src=' + this.client.wrap(this.link(match)) + ' class="emoji" data-name="' + match + '"></img>').replace(/\\?:([a-zA-Z_]+):/g, (match, name) => !match.startsWith('\\') && this.uni_obj[name] ? '<img src=' + this.client.wrap(this.link(this.uni_obj[name])) + ' class="emoji" data-name="' + this.uni_obj[name] + '"></img>' : match);
	}
	process(str, repl){
		return (str + '').replace(this.regex, match => repl(this.point(match)));
	}
	point(str){
		var r = [],
			c = 0,
			p = 0,
			i = 0;
		while (i < str.length) {
			c = str.charCodeAt(i++);
			
			if (p)r.push((65536 + (p - 55296 << 10) + (c - 56320)).toString(16)), p = 0;
			else if(55296 <= c && c <= 56319)p = c
			else r.push(c.toString(16));
		}
		
		return r.join('-');
	}
};

module.exports = Emojis;

/***/ }),

/***/ "./client/libs/Discord/Form.js":
/*!*************************************!*\
  !*** ./client/libs/Discord/Form.js ***!
  \*************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js"),
	Events = __webpack_require__(/*! ../../../libs/Events */ "./libs/Events.js"),
	{ nodes } = __webpack_require__(/*! ../constants */ "./client/libs/constants.js");

class Form extends Events {
	constructor(title, description, hint = '', closable = true){
		super();
		
		this.cover = DOM.add_ele('div', nodes.body, { className: 'page-cover' });
		
		this.cover.dataset.title = title;
		
		this.closable = closable;
		
		this.wrapper = DOM.add_ele('form', this.cover, { className: 'dialog' });
		
		this.inputs = {};
		
		this.upper = DOM.add_ele('div', this.wrapper, { className: 'upper' });
		this.lower = DOM.add_ele('div', this.wrapper, { className: 'lower' });
		
		this.title = DOM.add_ele('div', this.upper, { className: 'title', textContent: title });
		this.description = DOM.add_ele('div', this.upper, { className: 'description', textContent: description });
		
		if(hint)this.hint = DOM.add_ele('div', this.upper, { className: 'hint', textContent: hint });
		
		this.cover.addEventListener('click', event => this.closable && event.target == this.cover && this.close() + reject());
		
		this.wrapper.addEventListener('submit', event => this.emit('submit', {
			node: event.submitter,
			prevent_default(){
				this.default_prevented = true;
				event.preventDefault();
			},
		}));
	}
	addEventListener(name, callback){
		console.error('depricated addEventListener call', name, callback);
		this.wrapper.addEventListener(name, callback);
	}
	error(data){
		for(var label in this.inputs)this.inputs[label].wrapper.classList.remove('error');
		
		for(var label in data){
			label = label.toLowerCase();
			
			this.inputs[label].wrapper.classList.add('error');
			this.inputs[label].error.textContent = ' - ' + data[label];
		}
	}
	close(){
		this.cover.remove();
	}
};

class Button {
	constructor(form, label, submit = false){
		this.main = DOM.add_ele('button', form.lower, { className: 'button' + (submit ? '' : ' invis'), textContent: label, type: submit ? 'submit' : 'button' });
		
		if(['cancel', 'close'].includes(label.toLowerCase()))this.addEventListener('click', () => form.closable && form.close());
	}
	addEventListener(name, callback){
		this.main.addEventListener(name, callback);
	}
};

class Input {
	constructor(form, label, type, value = ''){
		form.inputs[label.toLowerCase()] = this;
		
		this.wrapper = DOM.add_ele('div', form.upper, { className: 'input' });
		
		this.label = DOM.add_ele('div', this.wrapper, { textContent: label, className: 'label' });
		
		this.error = DOM.add_ele('div', this.label, { className: 'error' });
		
		this.input = DOM.add_ele('input', this.wrapper, { value: value, type: type, autocomplete: 'on', required: true });
	}
	get value(){
		return this.input.value;
	}
	set value(v){
		return this.input.value = v;
	}
};

Form.Button = Button;
Form.Input = Input;
module.exports = Form;

/***/ }),

/***/ "./client/libs/Discord/Guild.js":
/*!**************************************!*\
  !*** ./client/libs/Discord/Guild.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js"),
	assets = __webpack_require__(/*! ../../../data/assets */ "./data/assets.js"),
	Channel = __webpack_require__(/*! ./Channel */ "./client/libs/Discord/Channel.js"),
	{ cdn, nodes } = __webpack_require__(/*! ../constants */ "./client/libs/constants.js");

class Guild {
	constructor(client, data){
		this.client = client;
		this.channels = new Map();
		this.channel_nodes = new Map();
		this.categories = new Map();
		this.name = data.name;
		this.id = data.id;
		
		this.node = DOM.add_ele('div', nodes.guilds, { draggable: true, className: 'guild-icon' + (data.icon ? '' : ' no-icon'), style: data.icon ? 'background-image: url(' + cdn.url('https://cdn.discordapp.com/icons/' + data.id + '/' + data.icon + '?size=128') + ')' : null });
		
		if(data.id == 'home')this.node.innerHTML = assets.svg.home;
		else if(!data.icon && data.add_icon != false)this.node.textContent = data.name.split(' ').map(word => word[0]).join('');
		
		DOM.add_ele('div', this.node, { className: 'tooltip', textContent: data.name });
		
		this.node.addEventListener('click', event => {
			this.client.guilds.forEach(guild => guild.node.selected = false);
			if(!this.node.selected)this.node.selected ^= 1;
		});
		
		this.client.guilds.set(data.id, this);
		
		if(data.id == 'home')this.sep = DOM.add_ele('div', nodes.guilds, { className: 'guild-sep' });
		
		this.active = false;
		
		this.node.addEventListener('click', () => this.show());
		
		this.wrapper = DOM.add_ele('div', nodes.body, { className: 'guild' });
		
		this.sidebar = {
			bar: DOM.add_ele('div', this.wrapper, { className: 'sidebar' }),
		};
		
		this.user = { wrapper: DOM.add_ele('div', this.sidebar.bar, { className: 'user-info' }) };
		
		this.user.avatar = DOM.add_ele('div', this.user.wrapper, { className: 'avatar' });
		this.user.profile = DOM.add_ele('div', this.user.wrapper, { className: 'profile' });
		
		this.user.name = DOM.add_ele('div', this.user.profile, {
			className: 'name',
			textContent: this.client.user.name,
		});
		
		this.user.tag = DOM.add_ele('div', this.user.profile, { className: 'tag' });
		
		this.user.gears = DOM.add_ele('raw', this.user.wrapper, { html: assets.svg.gears });
		
		this.user.gears.classList.add('gears');
		
		this.user.gears.addEventListener('click', () => this.client.settings.show());
		
		this.sidebar.channels = DOM.add_ele('div', this.sidebar.bar, { className: 'channels' });
		
		this.sidebar.header = DOM.add_ele('div', this.sidebar.bar, { className: 'guild-header', innerHTML: data.name, });
		
		data.channels.sort((a, b) => a.pos - b.pos).forEach(data => new Channel(this, data));
		
		this.update();
	}
	delete(){
		this.wrapper.remove();
		
		this.node.remove();
		
		this.client.guilds.delete(this.id);
		
		if(this.sep)this.sep.remove();
		
		this.channels.forEach(channel => channel.delete());
	}
	update(){
		this.user.name.textContent = this.client.user.name;
		this.user.tag.innerHTML = '#' + this.client.user.discrim;
		this.user.avatar.style['background-image'] = 'url(' + cdn.url('http://cdn.discordapp.com/embed/avatars/' + (this.client.user.avatar || 0) + '.png', 0) + ')';
		// this.user.status.style.color = io.ws.readyState == 1 ? '#4FB' : '#F44';
		
		this.channels.forEach(channel => channel.update());
	}
	show(show_channel = true){
		this.read();
		
		if(this.active)return;
		
		this.active = true;
		this.node.classList.add('focused');
		
		this.client.guilds.forEach(guild => guild.id != this.id && guild.hide());
		
		this.wrapper.style.display = 'flex';
		
		var channel = this.last_channel ? this.channels.get(this.last_channel) : [...this.channels.values()].find(channel => ['friends', 'rules', 'general'].includes(channel.name));
		
		if(channel)channel.show(false);
	}
	hide(){
		this.active = false;
		
		this.channels.forEach(channel => channel.hide());
		
		this.wrapper.style.display = 'none';
		this.node.classList.remove('focused');
	}
	read(){
		this.node.classList.remove('unread');
	}
	unread(){
		this.node.classList.add('unread');
	}
};

module.exports = Guild;

/***/ }),

/***/ "./client/libs/Discord/Message.js":
/*!****************************************!*\
  !*** ./client/libs/Discord/Message.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js"),
	{ cdn, socket, obv } = __webpack_require__(/*! ../constants */ "./client/libs/constants.js"),
	template = document.querySelector('.templates > .message');

class Message {
	constructor(client, channel, data){
		if(!data)return;
		
		this.client = client;
		this.channel = channel;
		this.data = data;
		this.contents = new Map();
		
		this.channel.messages.set(this.data.id, this);
		
		var to_scroll = this.channel.can_scroll();
		
		this.node = this.channel.msg_list.appendChild(template.cloneNode(true));
		
		// DOM.add_ele('div', this.channel.msg_list, { className: 'message' });
		
		/*
			case'GUILD_MEMBER_JOIN':
			case'PINS_ADD':
			default:
		*/
		
		if(data.ref && data.ref.author){
			this.reference = DOM.add_ele('div', this.node, { className: 'reference' });
			
			// avatar
			obv.observe(DOM.add_ele('div', this.reference, { className: 'dynamic-image avatar', style: 'background-image:url(' + cdn.url(data.ref.author.avatar) + ')' }));
			
			// bot badge
			DOM.add_ele('div', this.reference, data.ref.author.bot ? { innerHTML: 'BOT', className: 'badge' } : {});
			
			// name
			DOM.add_ele('div', this.reference, { className: 'name', textContent: data.ref.author.name, style: 'color: ' + data.ref.author.color });
			
			var refid = data.ref.id;
			
			data.ref.reference = true;
			data.ref.id += 'reference';
			
			var cnt = new discord.content(this, this, data.ref, false);
			
			// iterate through messages, find content matching reference id
			cnt.content.addEventListener('click', () => this.client.channels.get(data.ref.channel).messages.forEach(message => message.contents.get(refid) && message.contents.get(refid).content.scrollIntoView(false)));
		}
		
		this.nodes = DOM.tree({
			container: this.node,
			avatar: '$ > .avatar',
			meta: {
				container: '^ > .meta',
				name: '$ > .name',
				timestamp: '$ > .timestamp',
			},
		});
		
		if(data.author.bot)this.nodes.meta.container.classList.add('bot');
		
		this.nodes.meta.name.textContent = data.author.name;
		this.nodes.meta.name.style.color = data.author.color;
		
		this.nodes.meta.timestamp = data.timestamp;
		
		if(to_scroll)this.channel.scroll();
		
		// set image after scroll
		this.nodes.avatar.style['background-image'] = 'url(' + cdn.url(this.data.author.avatar) + ')';
		obv.observe(this.nodes.avatar);
		
		this.data.webhook = this.data.author.bot && parseInt((this.data.author.name.match(/(?: : |^)(\d+)(?: : |$)/)||[,0])[1]);
		
		if(this.name && this.data.webhook)this.name.addEventListener('click', () => socket.get('dm', this.data.webhook, id => {
			if(this.client.channels.has(id))this.client.channels.get(id).show();
		}));
		
		[...this.channel.msg_list.childNodes].reverse().forEach((node, ind) => ind >= 50 && node.remove());
	}
	delete(){
		this.contents.forEach(content => content.delete());
		
		this.channel.messages.delete(this.data.id);
		
		this.node.remove();
	}
}

module.exports = Message;

/***/ }),

/***/ "./client/libs/Discord/Popup.js":
/*!**************************************!*\
  !*** ./client/libs/Discord/Popup.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js"),
	{ nodes } = __webpack_require__(/*! ../constants */ "./client/libs/constants.js");

class Popup {
	constructor(data){
		this.info = DOM.add_ele('div', nodes.popups, { style: 'opacity: 0', className: 'popup' });
		
		this.content = DOM.add_ele('div', this.info, { className: 'content' });
		
		if(data.title)this.title = DOM.add_ele('div', this.content, { className: 'title', innerHTML: data.title });
		
		if(data.content)this.text = DOM.add_ele('div', this.content, { className: 'text', innerHTML: data.content });
		
		this.fade_out = () => (this.info.style.opacity = 0, setTimeout(() => this.info.parentNode && this.info.parentNode.removeChild(this.info), 200));
		
		setTimeout(() => this.info.style.opacity = 1, 25)
		
		if(data.closeable){
			this.close = DOM.add_ele('div', this.info, { className: 'close', innerHTML: 'x' });
			this.close.addEventListener('click', this.fade_out);
		}
		
		if(data.expires)setTimeout(this.fade_out, data.expires);
	}
};

module.exports = Popup;

/***/ }),

/***/ "./client/libs/Discord/form.js":
/*!*************************************!*\
  !*** ./client/libs/Discord/form.js ***!
  \*************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var DOM = __webpack_require__(/*! ../DOM */ "./client/libs/DOM.js"),
	Events = __webpack_require__(/*! ../../../libs/Events */ "./libs/Events.js"),
	{ nodes } = __webpack_require__(/*! ../constants */ "./client/libs/constants.js");

class Form extends Events {
	constructor(title, description, hint = '', closable = true){
		super();
		
		this.cover = DOM.add_ele('div', nodes.body, { className: 'page-cover' });
		
		this.cover.dataset.title = title;
		
		this.closable = closable;
		
		this.wrapper = DOM.add_ele('form', this.cover, { className: 'dialog' });
		
		this.inputs = {};
		
		this.upper = DOM.add_ele('div', this.wrapper, { className: 'upper' });
		this.lower = DOM.add_ele('div', this.wrapper, { className: 'lower' });
		
		this.title = DOM.add_ele('div', this.upper, { className: 'title', textContent: title });
		this.description = DOM.add_ele('div', this.upper, { className: 'description', textContent: description });
		
		if(hint)this.hint = DOM.add_ele('div', this.upper, { className: 'hint', textContent: hint });
		
		this.cover.addEventListener('click', event => this.closable && event.target == this.cover && this.close() + reject());
		
		this.wrapper.addEventListener('submit', event => this.emit('submit', {
			node: event.submitter,
			prevent_default(){
				this.default_prevented = true;
				event.preventDefault();
			},
		}));
	}
	addEventListener(name, callback){
		console.error('depricated addEventListener call', name, callback);
		this.wrapper.addEventListener(name, callback);
	}
	error(data){
		for(var label in this.inputs)this.inputs[label].wrapper.classList.remove('error');
		
		for(var label in data){
			label = label.toLowerCase();
			
			this.inputs[label].wrapper.classList.add('error');
			this.inputs[label].error.textContent = ' - ' + data[label];
		}
	}
	close(){
		this.cover.remove();
	}
};

class Button {
	constructor(form, label, submit = false){
		this.main = DOM.add_ele('button', form.lower, { className: 'button' + (submit ? '' : ' invis'), textContent: label, type: submit ? 'submit' : 'button' });
		
		if(['cancel', 'close'].includes(label.toLowerCase()))this.addEventListener('click', () => form.closable && form.close());
	}
	addEventListener(name, callback){
		this.main.addEventListener(name, callback);
	}
};

class Input {
	constructor(form, label, type, value = ''){
		form.inputs[label.toLowerCase()] = this;
		
		this.wrapper = DOM.add_ele('div', form.upper, { className: 'input' });
		
		this.label = DOM.add_ele('div', this.wrapper, { textContent: label, className: 'label' });
		
		this.error = DOM.add_ele('div', this.label, { className: 'error' });
		
		this.input = DOM.add_ele('input', this.wrapper, { value: value, type: type, autocomplete: 'on', required: true });
	}
	get value(){
		return this.input.value;
	}
	set value(v){
		return this.input.value = v;
	}
};

Form.Button = Button;
Form.Input = Input;
module.exports = Form;

/***/ }),

/***/ "./client/libs/Discord/index.js":
/*!**************************************!*\
  !*** ./client/libs/Discord/index.js ***!
  \**************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Client = __webpack_require__(/*! ./Client */ "./client/libs/Discord/Client.js"),
	Form = __webpack_require__(/*! ./Form */ "./client/libs/Discord/Form.js"),
	Guild = __webpack_require__(/*! ./Guild */ "./client/libs/Discord/Guild.js"),
	Popup = __webpack_require__(/*! ./Popup */ "./client/libs/Discord/Popup.js");

exports.Client = Client;
exports.Form = Form;
exports.Popup = Popup;
exports.Guild = Guild;

/***/ }),

/***/ "./client/libs/Socket.js":
/*!*******************************!*\
  !*** ./client/libs/Socket.js ***!
  \*******************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Events = __webpack_require__(/*! ../../libs/Events */ "./libs/Events.js");

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

/***/ }),

/***/ "./client/libs/constants.js":
/*!**********************************!*\
  !*** ./client/libs/constants.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var DOM = __webpack_require__(/*! ./DOM */ "./client/libs/DOM.js"),
	CDN = __webpack_require__(/*! ../../libs/CDN */ "./libs/CDN.js"),
	Socket = __webpack_require__(/*! ./Socket */ "./client/libs/Socket.js");

exports.cdn = new CDN();

exports.nodes = DOM.tree({
	body: document.body,
	popups: '.popups',
	guilds: '.guild-list',
});

exports.socket = new Socket();

exports.obv = new IntersectionObserver(entries => {
	entries.forEach(entry => {
		if(entry.isIntersecting){
			if(entry.target.getAttribute('data-src'))entry.target.src = entry.target.getAttribute('data-src');
			else entry.target.classList.add('visible');
			
			exports.obv.unobserve(entry.target);
		}
	});
});

/***/ }),

/***/ "./data/assets.js":
/*!************************!*\
  !*** ./data/assets.js ***!
  \************************/
/***/ ((__unused_webpack_module, exports) => {



exports.emojis = {activity:{soccer:[9917],basketball:[127936],football:[127944],baseball:[9918],tennis:[127934],volleyball:[127952],rugby_football:[127945],"8ball":[127921],golf:[9971],golfer:[127948],ping_pong:[127955],badminton:[127992],hockey:[127954],field_hockey:[127953],cricket:[127951],ski:[127935],skier:[9975],snowboarder:[127938],ice_skate:[9976],bow_and_arrow:[127993],fishing_pole_and_fish:[127907],rowboat:[128675],swimmer:[127946],surfer:[127940],bath:[128704],basketball_player:[9977],lifter:[127947],bicyclist:[128692],mountain_bicyclist:[128693],horse_racing:[127943],levitate:[128372],trophy:[127942],running_shirt_with_sash:[127933],medal:[127941],military_medal:[127894],reminder_ribbon:[127895],rosette:[127989],ticket:[127915],tickets:[127903],performing_arts:[127917],art:[127912],circus_tent:[127914],microphone:[127908],headphones:[127911],musical_score:[127932],musical_keyboard:[127929],saxophone:[127927],trumpet:[127930],guitar:[127928],violin:[127931],clapper:[127916],video_game:[127918],space_invader:[128126],dart:[127919],game_die:[127922],slot_machine:[127920],bowling:[127923]},flags:{flag_ac:[127462,127464],flag_af:[127462,127467],flag_al:[127462,127473],flag_dz:[127465,127487],flag_ad:[127462,127465],flag_ao:[127462,127476],flag_ai:[127462,127470],flag_ag:[127462,127468],flag_ar:[127462,127479],flag_am:[127462,127474],flag_aw:[127462,127484],flag_au:[127462,127482],flag_at:[127462,127481],flag_az:[127462,127487],flag_bs:[127463,127480],flag_bh:[127463,127469],flag_bd:[127463,127465],flag_bb:[127463,127463],flag_by:[127463,127486],flag_be:[127463,127466],flag_bz:[127463,127487],flag_bj:[127463,127471],flag_bm:[127463,127474],flag_bt:[127463,127481],flag_bo:[127463,127476],flag_ba:[127463,127462],flag_bw:[127463,127484],flag_br:[127463,127479],flag_bn:[127463,127475],flag_bg:[127463,127468],flag_bf:[127463,127467],flag_bi:[127463,127470],flag_cv:[127464,127483],flag_kh:[127472,127469],flag_cm:[127464,127474],flag_ca:[127464,127462],flag_ky:[127472,127486],flag_cf:[127464,127467],flag_td:[127481,127465],flag_cl:[127464,127473],flag_cn:[127464,127475],flag_co:[127464,127476],flag_km:[127472,127474],flag_cg:[127464,127468],flag_cd:[127464,127465],flag_cr:[127464,127479],flag_hr:[127469,127479],flag_cu:[127464,127482],flag_cy:[127464,127486],flag_cz:[127464,127487],flag_dk:[127465,127472],flag_dj:[127465,127471],flag_dm:[127465,127474],flag_do:[127465,127476],flag_ec:[127466,127464],flag_eg:[127466,127468],flag_sv:[127480,127483],flag_gq:[127468,127478],flag_er:[127466,127479],flag_ee:[127466,127466],flag_et:[127466,127481],flag_fk:[127467,127472],flag_fo:[127467,127476],flag_fj:[127467,127471],flag_fi:[127467,127470],flag_fr:[127467,127479],flag_pf:[127477,127467],flag_ga:[127468,127462],flag_gm:[127468,127474],flag_ge:[127468,127466],flag_de:[127465,127466],flag_gh:[127468,127469],flag_gi:[127468,127470],flag_gr:[127468,127479],flag_gl:[127468,127473],flag_gd:[127468,127465],flag_gu:[127468,127482],flag_gt:[127468,127481],flag_gn:[127468,127475],flag_gw:[127468,127484],flag_gy:[127468,127486],flag_ht:[127469,127481],flag_hn:[127469,127475],flag_hk:[127469,127472],flag_hu:[127469,127482],flag_is:[127470,127480],flag_in:[127470,127475],flag_id:[127470,127465],flag_ir:[127470,127479],flag_iq:[127470,127478],flag_ie:[127470,127466],flag_il:[127470,127473],flag_it:[127470,127481],flag_ci:[127464,127470],flag_jm:[127471,127474],flag_jp:[127471,127477],flag_je:[127471,127466],flag_jo:[127471,127476],flag_kz:[127472,127487],flag_ke:[127472,127466],flag_ki:[127472,127470],flag_xk:[127485,127472],flag_kw:[127472,127484],flag_kg:[127472,127468],flag_la:[127473,127462],flag_lv:[127473,127483],flag_lb:[127473,127463],flag_ls:[127473,127480],flag_lr:[127473,127479],flag_ly:[127473,127486],flag_li:[127473,127470],flag_lt:[127473,127481],flag_lu:[127473,127482],flag_mo:[127474,127476],flag_mk:[127474,127472],flag_mg:[127474,127468],flag_mw:[127474,127484],flag_my:[127474,127486],flag_mv:[127474,127483],flag_ml:[127474,127473],flag_mt:[127474,127481],flag_mh:[127474,127469],flag_mr:[127474,127479],flag_mu:[127474,127482],flag_mx:[127474,127485],flag_fm:[127467,127474],flag_md:[127474,127465],flag_mc:[127474,127464],flag_mn:[127474,127475],flag_me:[127474,127466],flag_ms:[127474,127480],flag_ma:[127474,127462],flag_mz:[127474,127487],flag_mm:[127474,127474],flag_na:[127475,127462],flag_nr:[127475,127479],flag_np:[127475,127477],flag_nl:[127475,127473],flag_nc:[127475,127464],flag_nz:[127475,127487],flag_ni:[127475,127470],flag_ne:[127475,127466],flag_ng:[127475,127468],flag_nu:[127475,127482],flag_kp:[127472,127477],flag_no:[127475,127476],flag_om:[127476,127474],flag_pk:[127477,127472],flag_pw:[127477,127484],flag_ps:[127477,127480],flag_pa:[127477,127462],flag_pg:[127477,127468],flag_py:[127477,127486],flag_pe:[127477,127466],flag_ph:[127477,127469],flag_pl:[127477,127473],flag_pt:[127477,127481],flag_pr:[127477,127479],flag_qa:[127478,127462],flag_ro:[127479,127476],flag_ru:[127479,127482],flag_rw:[127479,127484],flag_sh:[127480,127469],flag_kn:[127472,127475],flag_lc:[127473,127464],flag_vc:[127483,127464],flag_ws:[127484,127480],flag_sm:[127480,127474],flag_st:[127480,127481],flag_sa:[127480,127462],flag_sn:[127480,127475],flag_rs:[127479,127480],flag_sc:[127480,127464],flag_sl:[127480,127473],flag_sg:[127480,127468],flag_sk:[127480,127472],flag_si:[127480,127470],flag_sb:[127480,127463],flag_so:[127480,127476],flag_za:[127487,127462],flag_kr:[127472,127479],flag_es:[127466,127480],flag_lk:[127473,127472],flag_sd:[127480,127465],flag_sr:[127480,127479],flag_sz:[127480,127487],flag_se:[127480,127466],flag_ch:[127464,127469],flag_sy:[127480,127486],flag_tw:[127481,127484],flag_tj:[127481,127471],flag_tz:[127481,127487],flag_th:[127481,127469],flag_tl:[127481,127473],flag_tg:[127481,127468],flag_to:[127481,127476],flag_tt:[127481,127481],flag_tn:[127481,127475],flag_tr:[127481,127479],flag_tm:[127481,127474],flag_tv:[127481,127483],flag_ug:[127482,127468],flag_ua:[127482,127462],flag_ae:[127462,127466],flag_gb:[127468,127463],flag_us:[127482,127480],flag_vi:[127483,127470],flag_uy:[127482,127486],flag_uz:[127482,127487],flag_vu:[127483,127482],flag_va:[127483,127462],flag_ve:[127483,127466],flag_vn:[127483,127475],flag_wf:[127484,127467],flag_eh:[127466,127469],flag_ye:[127486,127466],flag_zm:[127487,127474],flag_zw:[127487,127484],flag_re:[127479,127466],flag_ax:[127462,127485],flag_ta:[127481,127462],flag_io:[127470,127476],flag_bq:[127463,127478],flag_cx:[127464,127485],flag_cc:[127464,127464],flag_gg:[127468,127468],flag_im:[127470,127474],flag_yt:[127486,127481],flag_nf:[127475,127467],flag_pn:[127477,127475],flag_bl:[127463,127473],flag_pm:[127477,127474],flag_gs:[127468,127480],flag_tk:[127481,127472],flag_bv:[127463,127483],flag_hm:[127469,127474],flag_sj:[127480,127471],flag_um:[127482,127474],flag_ic:[127470,127464],flag_ea:[127466,127462],flag_cp:[127464,127477],flag_dg:[127465,127468],flag_as:[127462,127480],flag_aq:[127462,127478],flag_vg:[127483,127468],flag_ck:[127464,127472],flag_cw:[127464,127484],flag_eu:[127466,127482],flag_gf:[127468,127467],flag_tf:[127481,127467],flag_gp:[127468,127477],flag_mq:[127474,127478],flag_mp:[127474,127477],flag_sx:[127480,127485],flag_ss:[127480,127480],flag_tc:[127481,127464],flag_mf:[127474,127467]},food:{green_apple:[127823],apple:[127822],pear:[127824],tangerine:[127818],lemon:[127819],banana:[127820],watermelon:[127817],grapes:[127815],strawberry:[127827],melon:[127816],cherries:[127826],peach:[127825],pineapple:[127821],tomato:[127813],eggplant:[127814],hot_pepper:[127798],corn:[127805],sweet_potato:[127840],honey_pot:[127855],bread:[127838],cheese:[129472],poultry_leg:[127831],meat_on_bone:[127830],fried_shrimp:[127844],egg:[127859],cooking:[127859],hamburger:[127828],fries:[127839],hotdog:[127789],pizza:[127829],spaghetti:[127837],taco:[127790],burrito:[127791],ramen:[127836],stew:[127858],fish_cake:[127845],sushi:[127843],bento:[127857],curry:[127835],rice_ball:[127833],rice:[127834],rice_cracker:[127832],oden:[127842],dango:[127841],shaved_ice:[127847],ice_cream:[127848],icecream:[127846],cake:[127856],birthday:[127874],custard:[127854],candy:[127852],lollipop:[127853],chocolate_bar:[127851],popcorn:[127871],doughnut:[127849],cookie:[127850],beer:[127866],beers:[127867],wine_glass:[127863],cocktail:[127864],tropical_drink:[127865],champagne:[127870],sake:[127862],tea:[127861],coffee:[9749],baby_bottle:[127868],fork_and_knife:[127860],fork_knife_plate:[127869]},nature:{dog:[128054],cat:[128049],mouse:[128045],hamster:[128057],rabbit:[128048],bear:[128059],panda_face:[128060],koala:[128040],tiger:[128047],lion_face:[129409],cow:[128046],pig:[128055],pig_nose:[128061],frog:[128056],octopus:[128025],monkey_face:[128053],see_no_evil:[128584],hear_no_evil:[128585],speak_no_evil:[128586],monkey:[128018],chicken:[128020],penguin:[128039],bird:[128038],baby_chick:[128036],hatching_chick:[128035],hatched_chick:[128037],wolf:[128058],boar:[128023],horse:[128052],unicorn:[129412],bee:[128029],honeybee:[128029],bug:[128027],snail:[128012],beetle:[128030],ant:[128028],spider:[128375],scorpion:[129410],crab:[129408],snake:[128013],turtle:[128034],tropical_fish:[128032],fish:[128031],blowfish:[128033],dolphin:[128044],flipper:[128044],whale:[128051],"whale2":[128011],crocodile:[128010],leopard:[128006],"tiger2":[128005],water_buffalo:[128003],ox:[128002],"cow2":[128004],dromedary_camel:[128042],camel:[128043],elephant:[128024],goat:[128016],ram:[128015],sheep:[128017],racehorse:[128014],"pig2":[128022],rat:[128000],"mouse2":[128001],rooster:[128019],turkey:[129411],dove:[128330],"dog2":[128021],poodle:[128041],"cat2":[128008],"rabbit2":[128007],chipmunk:[128063],feet:[128062],paw_prints:[128062],dragon:[128009],dragon_face:[128050],cactus:[127797],christmas_tree:[127876],evergreen_tree:[127794],deciduous_tree:[127795],palm_tree:[127796],seedling:[127793],herb:[127807],shamrock:[9752],four_leaf_clover:[127808],bamboo:[127885],tanabata_tree:[127883],leaves:[127811],fallen_leaf:[127810],maple_leaf:[127809],ear_of_rice:[127806],hibiscus:[127802],sunflower:[127803],rose:[127801],tulip:[127799],blossom:[127804],cherry_blossom:[127800],bouquet:[128144],mushroom:[127812],chestnut:[127792],jack_o_lantern:[127875],shell:[128026],spider_web:[128376],earth_americas:[127758],earth_africa:[127757],earth_asia:[127759],full_moon:[127765],waning_gibbous_moon:[127766],last_quarter_moon:[127767],waning_crescent_moon:[127768],new_moon:[127761],waxing_crescent_moon:[127762],first_quarter_moon:[127763],waxing_gibbous_moon:[127764],moon:[127764],new_moon_with_face:[127770],full_moon_with_face:[127773],first_quarter_moon_with_face:[127771],last_quarter_moon_with_face:[127772],sun_with_face:[127774],crescent_moon:[127769],star:[11088],"star2":[127775],dizzy:[128171],sparkles:[10024],comet:[9732],sunny:[9728],white_sun_small_cloud:[127780],partly_sunny:[9925],white_sun_cloud:[127781],white_sun_rain_cloud:[127782],cloud:[9729],cloud_rain:[127783],thunder_cloud_rain:[9928],cloud_lightning:[127785],zap:[9889],fire:[128293],boom:[128165],collision:[128165],snowflake:[10052],cloud_snow:[127784],"snowman2":[9731],snowman:[9924],wind_blowing_face:[127788],dash:[128168],cloud_tornado:[127786],fog:[127787],"umbrella2":[9730],umbrella:[9748],droplet:[128167],sweat_drops:[128166],ocean:[127754]},objects:{watch:[8986],iphone:[128241],calling:[128242],computer:[128187],keyboard:[9000],desktop:[128421],printer:[128424],mouse_three_button:[128433],trackball:[128434],joystick:[128377],compression:[128476],minidisc:[128189],floppy_disk:[128190],cd:[128191],dvd:[128192],vhs:[128252],camera:[128247],camera_with_flash:[128248],video_camera:[128249],movie_camera:[127909],projector:[128253],film_frames:[127902],telephone_receiver:[128222],telephone:[9742],phone:[9742],pager:[128223],fax:[128224],tv:[128250],radio:[128251],"microphone2":[127897],level_slider:[127898],control_knobs:[127899],stopwatch:[9201],timer:[9202],alarm_clock:[9200],clock:[128368],hourglass_flowing_sand:[9203],hourglass:[8987],satellite:[128225],battery:[128267],electric_plug:[128268],bulb:[128161],flashlight:[128294],candle:[128367],wastebasket:[128465],oil:[128738],money_with_wings:[128184],dollar:[128181],yen:[128180],euro:[128182],pound:[128183],moneybag:[128176],credit_card:[128179],gem:[128142],scales:[9878],wrench:[128295],hammer:[128296],hammer_pick:[9874],tools:[128736],pick:[9935],nut_and_bolt:[128297],gear:[9881],chains:[9939],gun:[128299],bomb:[128163],knife:[128298],hocho:[128298],dagger:[128481],crossed_swords:[9876],shield:[128737],smoking:[128684],skull_crossbones:[9760],coffin:[9904],urn:[9905],amphora:[127994],crystal_ball:[128302],prayer_beads:[128255],barber:[128136],alembic:[9879],telescope:[128301],microscope:[128300],hole:[128371],pill:[128138],syringe:[128137],thermometer:[127777],label:[127991],bookmark:[128278],toilet:[128701],shower:[128703],bathtub:[128705],key:[128273],"key2":[128477],couch:[128715],sleeping_accommodation:[128716],bed:[128719],door:[128682],bellhop:[128718],frame_photo:[128444],map:[128506],beach_umbrella:[9969],moyai:[128511],shopping_bags:[128717],balloon:[127880],flags:[127887],ribbon:[127872],gift:[127873],confetti_ball:[127882],tada:[127881],dolls:[127886],wind_chime:[127888],crossed_flags:[127884],izakaya_lantern:[127982],lantern:[127982],envelope:[9993],email:[128231],envelope_with_arrow:[128233],incoming_envelope:[128232],love_letter:[128140],postbox:[128238],mailbox_closed:[128234],mailbox:[128235],mailbox_with_mail:[128236],mailbox_with_no_mail:[128237],package:[128230],postal_horn:[128239],inbox_tray:[128229],outbox_tray:[128228],scroll:[128220],page_with_curl:[128195],bookmark_tabs:[128209],bar_chart:[128202],chart_with_upwards_trend:[128200],chart_with_downwards_trend:[128201],page_facing_up:[128196],date:[128197],calendar:[128198],calendar_spiral:[128467],card_index:[128199],card_box:[128451],ballot_box:[128499],file_cabinet:[128452],clipboard:[128203],notepad_spiral:[128466],file_folder:[128193],open_file_folder:[128194],dividers:[128450],"newspaper2":[128478],newspaper:[128240],notebook:[128211],closed_book:[128213],green_book:[128215],blue_book:[128216],orange_book:[128217],notebook_with_decorative_cover:[128212],ledger:[128210],books:[128218],book:[128214],open_book:[128214],link:[128279],paperclip:[128206],paperclips:[128391],scissors:[9986],triangular_ruler:[128208],straight_ruler:[128207],pushpin:[128204],round_pushpin:[128205],triangular_flag_on_post:[128681],flag_white:[127987],flag_black:[127988],closed_lock_with_key:[128272],lock:[128274],unlock:[128275],lock_with_ink_pen:[128271],pen_ballpoint:[128394],pen_fountain:[128395],black_nib:[10002],pencil:[128221],memo:[128221],"pencil2":[9999],crayon:[128397],paintbrush:[128396],mag:[128269],mag_right:[128270]},people:{grinning:[128512],grimacing:[128556],grin:[128513],joy:[128514],smiley:[128515],smile:[128516],sweat_smile:[128517],laughing:[128518],satisfied:[128518],innocent:[128519],wink:[128521],blush:[128522],slight_smile:[128578],upside_down:[128579],relaxed:[9786],yum:[128523],relieved:[128524],heart_eyes:[128525],kissing_heart:[128536],kissing:[128535],kissing_smiling_eyes:[128537],kissing_closed_eyes:[128538],stuck_out_tongue_winking_eye:[128540],stuck_out_tongue_closed_eyes:[128541],stuck_out_tongue:[128539],money_mouth:[129297],nerd:[129299],sunglasses:[128526],hugging:[129303],smirk:[128527],no_mouth:[128566],neutral_face:[128528],expressionless:[128529],unamused:[128530],rolling_eyes:[128580],thinking:[129300],flushed:[128563],disappointed:[128542],worried:[128543],angry:[128544],rage:[128545],pensive:[128532],confused:[128533],slight_frown:[128577],"frowning2":[9785],persevere:[128547],confounded:[128534],tired_face:[128555],weary:[128553],triumph:[128548],open_mouth:[128558],scream:[128561],fearful:[128552],cold_sweat:[128560],hushed:[128559],frowning:[128550],anguished:[128551],cry:[128546],disappointed_relieved:[128549],sleepy:[128554],sweat:[128531],sob:[128557],dizzy_face:[128565],astonished:[128562],zipper_mouth:[129296],mask:[128567],thermometer_face:[129298],head_bandage:[129301],sleeping:[128564],zzz:[128164],poop:[128169],shit:[128169],smiling_imp:[128520],imp:[128127],japanese_ogre:[128121],japanese_goblin:[128122],skull:[128128],ghost:[128123],alien:[128125],robot:[129302],smiley_cat:[128570],smile_cat:[128568],joy_cat:[128569],heart_eyes_cat:[128571],smirk_cat:[128572],kissing_cat:[128573],scream_cat:[128576],crying_cat_face:[128575],pouting_cat:[128574],raised_hands:[128588],clap:[128079],wave:[128075],thumbsup:[128077],"+1":[128077],thumbsdown:[128078],"-1":[128078],punch:[128074],facepunch:[128074],fist:[9994],v:[9996],ok_hand:[128076],raised_hand:[9995],hand:[9995],open_hands:[128080],muscle:[128170],pray:[128591],point_up:[9757],"point_up_2":[128070],point_down:[128071],point_left:[128072],point_right:[128073],middle_finger:[128405],hand_splayed:[128400],metal:[129304],vulcan:[128406],writing_hand:[9997],nail_care:[128133],lips:[128068],tongue:[128069],ear:[128066],nose:[128067],eye:[128065],eyes:[128064],bust_in_silhouette:[128100],busts_in_silhouette:[128101],speaking_head:[128483],baby:[128118],boy:[128102],girl:[128103],man:[128104],woman:[128105],person_with_blond_hair:[128113],older_man:[128116],older_woman:[128117],man_with_gua_pi_mao:[128114],man_with_turban:[128115],cop:[128110],construction_worker:[128119],guardsman:[128130],spy:[128373],santa:[127877],angel:[128124],princess:[128120],bride_with_veil:[128112],walking:[128694],runner:[127939],running:[127939],dancer:[128131],dancers:[128111],couple:[128107],two_men_holding_hands:[128108],two_women_holding_hands:[128109],bow:[128583],information_desk_person:[128129],no_good:[128581],ok_woman:[128582],raising_hand:[128587],person_with_pouting_face:[128590],person_frowning:[128589],haircut:[128135],massage:[128134],couple_with_heart:[128145],couple_ww:[128105,8205],couple_mm:[128104,8205],couplekiss:[128143],kiss_ww:[128105,8205],kiss_mm:[128104,8205],family:[128106],family_mwg:[128104,8205],family_mwgb:[128104,8205],family_mwbb:[128104,8205],family_mwgg:[128104,8205],family_wwb:[128105,8205],family_wwg:[128105,8205],family_wwgb:[128105,8205],family_wwbb:[128105,8205],family_wwgg:[128105,8205],family_mmb:[128104,8205],family_mmg:[128104,8205],family_mmgb:[128104,8205],family_mmbb:[128104,8205],family_mmgg:[128104,8205],womans_clothes:[128090],shirt:[128085],tshirt:[128085],jeans:[128086],necktie:[128084],dress:[128087],bikini:[128089],kimono:[128088],lipstick:[128132],kiss:[128139],footprints:[128099],high_heel:[128096],sandal:[128097],boot:[128098],mans_shoe:[128094],shoe:[128094],athletic_shoe:[128095],womans_hat:[128082],tophat:[127913],helmet_with_cross:[9937],mortar_board:[127891],crown:[128081],school_satchel:[127890],pouch:[128093],purse:[128091],handbag:[128092],briefcase:[128188],eyeglasses:[128083],dark_sunglasses:[128374],ring:[128141],closed_umbrella:[127746]},symbols:{"100":[128175],"1234":[128290],heart:[10084],yellow_heart:[128155],green_heart:[128154],blue_heart:[128153],purple_heart:[128156],broken_heart:[128148],heart_exclamation:[10083],two_hearts:[128149],revolving_hearts:[128158],heartbeat:[128147],heartpulse:[128151],sparkling_heart:[128150],cupid:[128152],gift_heart:[128157],heart_decoration:[128159],peace:[9774],cross:[10013],star_and_crescent:[9770],om_symbol:[128329],wheel_of_dharma:[9784],star_of_david:[10017],six_pointed_star:[128303],menorah:[128334],yin_yang:[9775],orthodox_cross:[9766],place_of_worship:[128720],ophiuchus:[9934],aries:[9800],taurus:[9801],gemini:[9802],cancer:[9803],leo:[9804],virgo:[9805],libra:[9806],scorpius:[9807],sagittarius:[9808],capricorn:[9809],aquarius:[9810],pisces:[9811],id:[127380],atom:[9883],"u7a7a":[127539],"u5272":[127545],radioactive:[9762],biohazard:[9763],mobile_phone_off:[128244],vibration_mode:[128243],"u6709":[127542],"u7121":[127514],"u7533":[127544],"u55b6":[127546],"u6708":[127543],eight_pointed_black_star:[10036],vs:[127386],accept:[127569],white_flower:[128174],ideograph_advantage:[127568],secret:[12953],congratulations:[12951],"u5408":[127540],"u6e80":[127541],"u7981":[127538],a:[127344],b:[127345],ab:[127374],cl:[127377],"o2":[127358],sos:[127384],no_entry:[9940],name_badge:[128219],no_entry_sign:[128683],x:[10060],o:[11093],anger:[128162],hotsprings:[9832],no_pedestrians:[128695],do_not_litter:[128687],no_bicycles:[128691],non_potable_water:[128689],underage:[128286],no_mobile_phones:[128245],exclamation:[10071],heavy_exclamation_mark:[10071],grey_exclamation:[10069],question:[10067],grey_question:[10068],bangbang:[8252],interrobang:[8265],low_brightness:[128261],high_brightness:[128262],trident:[128305],fleur_de_lis:[9884],part_alternation_mark:[12349],warning:[9888],children_crossing:[128696],beginner:[128304],recycle:[9851],"u6307":[127535],chart:[128185],sparkle:[10055],eight_spoked_asterisk:[10035],negative_squared_cross_mark:[10062],white_check_mark:[9989],diamond_shape_with_a_dot_inside:[128160],cyclone:[127744],loop:[10175],globe_with_meridians:[127760],m:[9410],atm:[127975],sa:[127490],passport_control:[128706],customs:[128707],baggage_claim:[128708],left_luggage:[128709],wheelchair:[9855],no_smoking:[128685],wc:[128702],parking:[127359],potable_water:[128688],mens:[128697],womens:[128698],baby_symbol:[128700],restroom:[128699],put_litter_in_its_place:[128686],cinema:[127910],signal_strength:[128246],koko:[127489],ng:[127382],ok:[127383],up:[127385],cool:[127378],new:[127381],free:[127379],zero:[48],one:[49],two:[50],three:[51],four:[52],five:[53],six:[54],seven:[55],eight:[56],nine:[57],ten:[128287],keycap_ten:[128287],arrow_forward:[9654],pause_button:[9208],play_pause:[9199],stop_button:[9209],record_button:[9210],track_next:[9197],track_previous:[9198],fast_forward:[9193],rewind:[9194],twisted_rightwards_arrows:[128256],repeat:[128257],repeat_one:[128258],arrow_backward:[9664],arrow_up_small:[128316],arrow_down_small:[128317],arrow_double_up:[9195],arrow_double_down:[9196],arrow_right:[10145],arrow_left:[11013],arrow_up:[11014],arrow_down:[11015],arrow_upper_right:[8599],arrow_lower_right:[8600],arrow_lower_left:[8601],arrow_upper_left:[8598],arrow_up_down:[8597],left_right_arrow:[8596],arrows_counterclockwise:[128260],arrow_right_hook:[8618],leftwards_arrow_with_hook:[8617],arrow_heading_up:[10548],arrow_heading_down:[10549],hash:[35],asterisk:[42],information_source:[8505],abc:[128292],abcd:[128289],capital_abcd:[128288],symbols:[128291],musical_note:[127925],notes:[127926],wavy_dash:[12336],curly_loop:[10160],heavy_check_mark:[10004],arrows_clockwise:[128259],heavy_plus_sign:[10133],heavy_minus_sign:[10134],heavy_division_sign:[10135],heavy_multiplication_x:[10006],heavy_dollar_sign:[128178],currency_exchange:[128177],copyright:[169],registered:[174],tm:[8482],end:[128282],back:[128281],on:[128283],top:[128285],soon:[128284],ballot_box_with_check:[9745],radio_button:[128280],white_circle:[9898],black_circle:[9899],red_circle:[128308],large_blue_circle:[128309],small_orange_diamond:[128312],small_blue_diamond:[128313],large_orange_diamond:[128310],large_blue_diamond:[128311],small_red_triangle:[128314],black_small_square:[9642],white_small_square:[9643],black_large_square:[11035],white_large_square:[11036],small_red_triangle_down:[128315],black_medium_square:[9724],white_medium_square:[9723],black_medium_small_square:[9726],white_medium_small_square:[9725],black_square_button:[128306],white_square_button:[128307],speaker:[128264],sound:[128265],loud_sound:[128266],mute:[128263],mega:[128227],loudspeaker:[128226],bell:[128276],no_bell:[128277],black_joker:[127183],mahjong:[126980],spades:[9824],clubs:[9827],hearts:[9829],diamonds:[9830],flower_playing_cards:[127924],thought_balloon:[128173],anger_right:[128495],speech_balloon:[128172],"clock1":[128336],"clock2":[128337],"clock3":[128338],"clock4":[128339],"clock5":[128340],"clock6":[128341],"clock7":[128342],"clock8":[128343],"clock9":[128344],"clock10":[128345],"clock11":[128346],"clock12":[128347],"clock130":[128348],"clock230":[128349],"clock330":[128350],"clock430":[128351],"clock530":[128352],"clock630":[128353],"clock730":[128354],"clock830":[128355],"clock930":[128356],"clock1030":[128357],"clock1130":[128358],"clock1230":[128359],eye_in_speech_bubble:[128065,8205],speech_left:[128488],eject:[9167]},travel:{red_car:[128663],car:[128663],taxi:[128661],blue_car:[128665],bus:[128652],trolleybus:[128654],race_car:[127950],police_car:[128659],ambulance:[128657],fire_engine:[128658],minibus:[128656],truck:[128666],articulated_lorry:[128667],tractor:[128668],motorcycle:[127949],bike:[128690],rotating_light:[128680],oncoming_police_car:[128660],oncoming_bus:[128653],oncoming_automobile:[128664],oncoming_taxi:[128662],aerial_tramway:[128673],mountain_cableway:[128672],suspension_railway:[128671],railway_car:[128643],train:[128651],monorail:[128669],bullettrain_side:[128644],bullettrain_front:[128645],light_rail:[128648],mountain_railway:[128670],steam_locomotive:[128642],"train2":[128646],metro:[128647],tram:[128650],station:[128649],helicopter:[128641],airplane_small:[128745],airplane:[9992],airplane_departure:[128747],airplane_arriving:[128748],sailboat:[9973],boat:[9973],motorboat:[128741],speedboat:[128676],ferry:[9972],cruise_ship:[128755],rocket:[128640],satellite_orbital:[128752],seat:[128186],anchor:[9875],construction:[128679],fuelpump:[9981],busstop:[128655],vertical_traffic_light:[128678],traffic_light:[128677],checkered_flag:[127937],ship:[128674],ferris_wheel:[127905],roller_coaster:[127906],carousel_horse:[127904],construction_site:[127959],foggy:[127745],tokyo_tower:[128508],factory:[127981],fountain:[9970],rice_scene:[127889],mountain:[9968],mountain_snow:[127956],mount_fuji:[128507],volcano:[127755],japan:[128510],camping:[127957],tent:[9978],park:[127966],motorway:[128739],railway_track:[128740],sunrise:[127749],sunrise_over_mountains:[127748],desert:[127964],beach:[127958],island:[127965],city_sunset:[127751],city_sunrise:[127751],city_dusk:[127750],cityscape:[127961],night_with_stars:[127747],bridge_at_night:[127753],milky_way:[127756],stars:[127776],sparkler:[127879],fireworks:[127878],rainbow:[127752],homes:[127960],european_castle:[127984],japanese_castle:[127983],stadium:[127967],statue_of_liberty:[128509],house:[127968],house_with_garden:[127969],house_abandoned:[127962],office:[127970],department_store:[127980],post_office:[127971],european_post_office:[127972],hospital:[127973],bank:[127974],hotel:[127976],convenience_store:[127978],school:[127979],love_hotel:[127977],wedding:[128146],classical_building:[127963],church:[9962],mosque:[128332],synagogue:[128333],kaaba:[128331],shinto_shrine:[9961]}};

exports.names = {first:["abandoned","able","absolute","adorable","adventurous","academic","acceptable","acclaimed","accomplished","accurate","aching","acidic","acrobatic","active","actual","adept","admirable","admired","adolescent","adorable","adored","advanced","afraid","affectionate","aged","aggravating","aggressive","agile","agitated","agonizing","agreeable","ajar","alarmed","alarming","alert","alienated","alive","all","altruistic","amazing","ambitious","ample","amused","amusing","anchored","ancient","angelic","angry","anguished","animated","annual","another","antique","anxious","any","apprehensive","appropriate","apt","arctic","arid","aromatic","artistic","ashamed","assured","astonishing","athletic","attached","attentive","attractive","austere","authentic","authorized","automatic","avaricious","average","aware","awesome","awful","awkward","babyish","bad","back","baggy","bare","barren","basic","beautiful","belated","beloved","beneficial","better","best","bewitched","big","big-hearted","biodegradable","bite-sized","bitter","black","black-and-white","bland","blank","blaring","bleak","blind","blissful","blond","blue","blushing","bogus","boiling","bold","bony","boring","bossy","both","bouncy","bountiful","bowed","brave","breakable","brief","bright","brilliant","brisk","broken","bronze","brown","bruised","bubbly","bulky","bumpy","buoyant","burdensome","burly","bustling","busy","buttery","buzzing","calculating","calm","candid","canine","capital","carefree","careful","careless","caring","cautious","cavernous","celebrated","charming","cheap","cheerful","cheery","chief","chilly","chubby","circular","classic","clean","clear","clear-cut","clever","close","closed","cloudy","clueless","clumsy","cluttered","coarse","cold","colorful","colorless","colossal","comfortable","common","compassionate","competent","complete","complex","complicated","composed","concerned","concrete","confused","conscious","considerate","constant","content","conventional","cooked","cool","cooperative","coordinated","corny","corrupt","costly","courageous","courteous","crafty","crazy","creamy","creative","creepy","criminal","crisp","critical","crooked","crowded","cruel","crushing","cuddly","cultivated","cultured","cumbersome","curly","curvy","cute","cylindrical","damaged","damp","dangerous","dapper","daring","darling","dark","dazzling","dead","deadly","deafening","dear","dearest","decent","decimal","decisive","deep","defenseless","defensive","defiant","deficient","definite","definitive","delayed","delectable","delicious","delightful","delirious","demanding","dense","dental","dependable","dependent","descriptive","deserted","detailed","determined","devoted","different","difficult","digital","diligent","dim","dimpled","dimwitted","direct","disastrous","discrete","disfigured","disgusting","disloyal","dismal","distant","downright","dreary","dirty","disguised","dishonest","dismal","distant","distinct","distorted","dizzy","dopey","doting","double","downright","drab","drafty","dramatic","dreary","droopy","dry","dual","dull","dutiful","each","eager","earnest","early","easy","easy-going","ecstatic","edible","educated","elaborate","elastic","elated","elderly","electric","elegant","elementary","elliptical","embarrassed","embellished","eminent","emotional","empty","enchanted","enchanting","energetic","enlightened","enormous","enraged","entire","envious","equal","equatorial","essential","esteemed","ethical","euphoric","even","evergreen","everlasting","every","evil","exalted","excellent","exemplary","exhausted","excitable","excited","exciting","exotic","expensive","experienced","expert","extraneous","extroverted","extra-large","extra-small","fabulous","failing","faint","fair","faithful","fake","false","familiar","famous","fancy","fantastic","far","faraway","far-flung","far-off","fast","fat","fatal","fatherly","favorable","favorite","fearful","fearless","feisty","feline","female","feminine","few","fickle","filthy","fine","finished","firm","first","firsthand","fitting","fixed","flaky","flamboyant","flashy","flat","flawed","flawless","flickering","flimsy","flippant","flowery","fluffy","fluid","flustered","focused","fond","foolhardy","foolish","forceful","forked","formal","forsaken","forthright","fortunate","fragrant","frail","frank","frayed","free","French","fresh","frequent","friendly","frightened","frightening","frigid","frilly","frizzy","frivolous","front","frosty","frozen","frugal","fruitful","full","fumbling","functional","funny","fussy","fuzzy","gargantuan","gaseous","general","generous","gentle","genuine","giant","giddy","gigantic","gifted","giving","glamorous","glaring","glass","gleaming","gleeful","glistening","glittering","gloomy","glorious","glossy","glum","golden","good","good-natured","gorgeous","graceful","gracious","grand","grandiose","granular","grateful","grave","gray","great","greedy","green","gregarious","grim","grimy","gripping","grizzled","gross","grotesque","grouchy","grounded","growing","growling","grown","grubby","gruesome","grumpy","guilty","gullible","gummy","hairy","half","handmade","handsome","handy","happy","happy-go-lucky","hard","hard-to-find","harmful","harmless","harmonious","harsh","hasty","hateful","haunting","healthy","heartfelt","hearty","heavenly","heavy","hefty","helpful","helpless","hidden","hideous","high","high-level","hilarious","hoarse","hollow","homely","honest","honorable","honored","hopeful","horrible","hospitable","hot","huge","humble","humiliating","humming","humongous","hungry","hurtful","husky","icky","icy","ideal","idealistic","identical","idle","idiotic","idolized","ignorant","ill","illegal","ill-fated","ill-informed","illiterate","illustrious","imaginary","imaginative","immaculate","immaterial","immediate","immense","impassioned","impeccable","impartial","imperfect","imperturbable","impish","impolite","important","impossible","impractical","impressionable","impressive","improbable","impure","inborn","incomparable","incompatible","incomplete","inconsequential","incredible","indelible","inexperienced","indolent","infamous","infantile","infatuated","inferior","infinite","informal","innocent","insecure","insidious","insignificant","insistent","instructive","insubstantial","intelligent","intent","intentional","interesting","internal","international","intrepid","ironclad","irresponsible","irritating","itchy","jaded","jagged","jam-packed","jaunty","jealous","jittery","joint","jolly","jovial","joyful","joyous","jubilant","judicious","juicy","jumbo","junior","jumpy","juvenile","kaleidoscopic","keen","key","kind","kindhearted","kindly","klutzy","knobby","knotty","knowledgeable","knowing","known","kooky","kosher","lame","lanky","large","last","lasting","late","lavish","lawful","lazy","leading","lean","leafy","left","legal","legitimate","light","lighthearted","likable","likely","limited","limp","limping","linear","lined","liquid","little","live","lively","livid","loathsome","lone","lonely","long","long-term","loose","lopsided","lost","loud","lovable","lovely","loving","low","loyal","lucky","lumbering","luminous","lumpy","lustrous","luxurious","mad","made-up","magnificent","majestic","major","male","mammoth","married","marvelous","masculine","massive","mature","meager","mealy","mean","measly","meaty","medical","mediocre","medium","meek","mellow","melodic","memorable","menacing","merry","messy","metallic","mild","milky","mindless","miniature","minor","minty","miserable","miserly","misguided","misty","mixed","modern","modest","moist","monstrous","monthly","monumental","moral","mortified","motherly","motionless","mountainous","muddy","muffled","multicolored","mundane","murky","mushy","musty","muted","mysterious","naive","narrow","nasty","natural","naughty","nautical","near","neat","necessary","needy","negative","neglected","negligible","neighboring","nervous","new","next","nice","nifty","nimble","nippy","nocturnal","noisy","nonstop","normal","notable","noted","noteworthy","novel","noxious","numb","nutritious","nutty","obedient","obese","oblong","oily","oblong","obvious","occasional","odd","oddball","offbeat","offensive","official","old","old-fashioned","only","open","optimal","optimistic","opulent","orange","orderly","organic","ornate","ornery","ordinary","original","other","our","outlying","outgoing","outlandish","outrageous","outstanding","oval","overcooked","overdue","overjoyed","overlooked","palatable","pale","paltry","parallel","parched","partial","passionate","past","pastel","peaceful","peppery","perfect","perfumed","periodic","perky","personal","pertinent","pesky","pessimistic","petty","phony","physical","piercing","pink","pitiful","plain","plaintive","plastic","playful","pleasant","pleased","pleasing","plump","plush","polished","polite","political","pointed","pointless","poised","poor","popular","portly","posh","positive","possible","potable","powerful","powerless","practical","precious","present","prestigious","pretty","precious","previous","pricey","prickly","primary","prime","pristine","private","prize","probable","productive","profitable","profuse","proper","proud","prudent","punctual","pungent","puny","pure","purple","pushy","putrid","puzzled","puzzling","quaint","qualified","quarrelsome","quarterly","queasy","querulous","questionable","quick","quick-witted","quiet","quintessential","quirky","quixotic","quizzical","radiant","ragged","rapid","rare","rash","raw","recent","reckless","rectangular","ready","real","realistic","reasonable","red","reflecting","regal","regular","reliable","relieved","remarkable","remorseful","remote","repentant","required","respectful","responsible","repulsive","revolving","rewarding","rich","rigid","right","ringed","ripe","roasted","robust","rosy","rotating","rotten","rough","round","rowdy","royal","rubbery","rundown","ruddy","rude","runny","rural","rusty","sad","safe","salty","same","sandy","sane","sarcastic","sardonic","satisfied","scaly","scarce","scared","scary","scented","scholarly","scientific","scornful","scratchy","scrawny","second","secondary","second-hand","secret","self-assured","self-reliant","selfish","sentimental","separate","serene","serious","serpentine","several","severe","shabby","shadowy","shady","shallow","shameful","shameless","sharp","shimmering","shiny","shocked","shocking","shoddy","short","short-term","showy","shrill","shy","sick","silent","silky","silly","silver","similar","simple","simplistic","sinful","single","sizzling","skeletal","skinny","sleepy","slight","slim","slimy","slippery","slow","slushy","small","smart","smoggy","smooth","smug","snappy","snarling","sneaky","sniveling","snoopy","sociable","soft","soggy","solid","somber","some","spherical","sophisticated","sore","sorrowful","soulful","soupy","sour","Spanish","sparkling","sparse","specific","spectacular","speedy","spicy","spiffy","spirited","spiteful","splendid","spotless","spotted","spry","square","squeaky","squiggly","stable","staid","stained","stale","standard","starchy","stark","starry","steep","sticky","stiff","stimulating","stingy","stormy","straight","strange","steel","strict","strident","striking","striped","strong","studious","stunning","stupendous","stupid","sturdy","stylish","subdued","submissive","substantial","subtle","suburban","sudden","sugary","sunny","super","superb","superficial","superior","supportive","sure-footed","surprised","suspicious","svelte","sweaty","sweet","sweltering","swift","sympathetic","tall","talkative","tame","tan","tangible","tart","tasty","tattered","taut","tedious","teeming","tempting","tender","tense","tepid","terrible","terrific","testy","thankful","that","these","thick","thin","third","thirsty","this","thorough","thorny","those","thoughtful","threadbare","thrifty","thunderous","tidy","tight","timely","tinted","tiny","tired","torn","total","tough","traumatic","treasured","tremendous","tragic","trained","tremendous","triangular","tricky","trifling","trim","trivial","troubled","true","trusting","trustworthy","trusty","truthful","tubby","turbulent","twin","ugly","ultimate","unacceptable","unaware","uncomfortable","uncommon","unconscious","understated","unequaled","uneven","unfinished","unfit","unfolded","unfortunate","unhappy","unhealthy","uniform","unimportant","unique","united","unkempt","unknown","unlawful","unlined","unlucky","unnatural","unpleasant","unrealistic","unripe","unruly","unselfish","unsightly","unsteady","unsung","untidy","untimely","untried","untrue","unused","unusual","unwelcome","unwieldy","unwilling","unwitting","unwritten","upbeat","upright","upset","urban","usable","used","useful","useless","utilized","utter","vacant","vague","vain","valid","valuable","vapid","variable","vast","velvety","venerated","vengeful","verifiable","vibrant","vicious","victorious","vigilant","vigorous","villainous","violet","violent","virtual","virtuous","visible","vital","vivacious","vivid","voluminous","wan","warlike","warm","warmhearted","warped","wary","wasteful","watchful","waterlogged","watery","wavy","wealthy","weak","weary","webbed","wee","weekly","weepy","weighty","weird","welcome","well-documented","well-groomed","well-informed","well-lit","well-made","well-off","well-to-do","well-worn","wet","which","whimsical","whirlwind","whispered","white","whole","whopping","wicked","wide","wide-eyed","wiggly","wild","willing","wilted","winding","windy","winged","wiry","wise","witty","wobbly","woeful","wonderful","wooden","woozy","wordy","worldly","worn","worried","worrisome","worse","worst","worthless","worthwhile","worthy","wrathful","wretched","writhing","wrong","wry","yawning","yearly","yellow","yellowish","young","youthful","yummy","zany","zealous","zesty","zigzag","rocky"],last:["people","history","way","art","world","information","map","family","government","health","system","computer","meat","year","thanks","music","person","reading","method","data","food","understanding","theory","law","bird","literature","problem","software","control","knowledge","power","ability","economics","love","internet","television","science","library","nature","fact","product","idea","temperature","investment","area","society","activity","story","industry","media","thing","oven","community","definition","safety","quality","development","language","management","player","variety","video","week","security","country","exam","movie","organization","equipment","physics","analysis","policy","series","thought","basis","boyfriend","direction","strategy","technology","army","camera","freedom","paper","environment","child","instance","month","truth","marketing","university","writing","article","department","difference","goal","nesocket","audience","fishing","growth","income","marriage","user","combination","failure","meaning","medicine","philosophy","teacher","communication","night","chemistry","disease","disk","energy","nation","road","role","soup","advertising","location","success","addition","apartment","education","math","moment","painting","politics","attention","decision","event","property","shopping","student","wood","competition","distribution","entertainment","office","population","president","unit","category","cigarette","context","introduction","opportunity","performance","driver","flight","length","magazine","nesocketpaper","relationship","teaching","cell","dealer","debate","finding","lake","member","message","phone","scene","appearance","association","concept","customer","death","discussion","housing","inflation","insurance","mood","woman","advice","blood","effort","expression","importance","opinion","payment","reality","responsibility","situation","skill","statement","wealth","application","city","county","depth","estate","foundation","grandmother","heart","perspective","photo","recipe","studio","topic","collection","depression","imagination","passion","percentage","resource","setting","ad","agency","college","connection","criticism","debt","description","memory","patience","secretary","solution","administration","aspect","attitude","director","personality","psychology","recommendation","response","selection","storage","version","alcohol","argument","complaint","contract","emphasis","highway","loss","membership","possession","preparation","steak","union","agreement","cancer","currency","employment","engineering","entry","interaction","limit","mixture","preference","region","republic","seat","tradition","virus","actor","classroom","delivery","device","difficulty","drama","election","engine","football","guidance","hotel","match","owner","priority","protection","suggestion","tension","variation","anxiety","atmosphere","awareness","bread","climate","comparison","confusion","construction","elevator","emotion","employee","employer","guest","height","leadership","mall","manager","operation","recording","respect","sample","transportation","boring","charity","cousin","disaster","editor","efficiency","excitement","extent","feedback","guitar","homework","leader","mom","outcome","permission","presentation","promotion","reflection","refrigerator","resolution","revenue","session","singer","tennis","basket","bonus","cabinet","childhood","church","clothes","coffee","dinner","drawing","hair","hearing","initiative","judgment","lab","measurement","mode","mud","orange","poetry","police","possibility","procedure","queen","ratio","relation","restaurant","satisfaction","sector","signature","significance","song","tooth","town","vehicle","volume","wife","accident","airport","appointment","arrival","assumption","baseball","chapter","committee","conversation","database","enthusiasm","error","explanation","farmer","gate","girl","hall","historian","hospital","injury","instruction","maintenance","manufacturer","meal","perception","pie","poem","presence","proposal","reception","replacement","revolution","river","son","speech","tea","village","warning","winner","worker","writer","assistance","breath","buyer","chest","chocolate","conclusion","contribution","cookie","courage","desk","drawer","establishment","examination","garbage","grocery","honey","impression","improvement","independence","insect","inspection","inspector","king","ladder","menu","penalty","piano","potato","profession","professor","quantity","reaction","requirement","salad","sister","supermarket","tongue","weakness","wedding","affair","ambition","analyst","apple","assignment","assistant","bathroom","bedroom","beer","birthday","celebration","championship","cheek","client","consequence","departure","diamond","dirt","ear","fortune","friendship","funeral","gene","girlfriend","hat","indication","intention","lady","midnight","negotiation","obligation","passenger","pizza","platform","poet","pollution","recognition","reputation","shirt","speaker","stranger","surgery","sympathy","tale","throat","trainer","uncle","youth","time","work","film","water","money","example","while","business","study","game","life","form","air","day","place","number","part","field","fish","back","process","heat","hand","experience","job","book","end","point","type","home","economy","value","body","market","guide","interest","state","radio","course","company","price","size","card","list","mind","trade","line","care","group","risk","word","fat","force","key","light","training","name","school","top","amount","level","order","practice","research","sense","service","piece","web","boss","sport","fun","house","page","term","test","answer","sound","focus","matter","kind","soil","board","oil","picture","access","garden","range","rate","reason","future","site","demand","exercise","image","case","cause","coast","action","age","bad","boat","record","result","section","building","mouse","cash","class","period","plan","store","tax","side","subject","space","rule","stock","weather","chance","figure","man","model","source","beginning","earth","program","chicken","design","feature","head","material","purpose","question","rock","salt","act","birth","car","dog","object","scale","sun","note","profit","rent","speed","style","war","bank","craft","half","inside","outside","standard","bus","exchange","eye","fire","position","pressure","stress","advantage","benefit","box","frame","issue","step","cycle","face","item","metal","paint","review","room","screen","structure","view","account","ball","discipline","medium","share","balance","bit","black","bottom","choice","gift","impact","machine","shape","tool","wind","address","average","career","culture","morning","pot","sign","table","task","condition","contact","credit","egg","hope","ice","network","north","square","attempt","date","effect","link","post","star","voice","capital","challenge","friend","self","shot","brush","couple","exit","front","function","lack","living","plant","plastic","spot","summer","taste","theme","track","wing","brain","button","click","desire","foot","gas","influence","notice","rain","wall","base","damage","distance","feeling","pair","savings","staff","sugar","target","text","animal","author","budget","discount","file","ground","lesson","minute","officer","phase","reference","register","sky","stage","stick","title","trouble","bowl","bridge","campaign","character","club","edge","evidence","fan","letter","lock","maximum","novel","option","pack","park","quarter","skin","sort","weight","baby","background","carry","dish","factor","fruit","glass","joint","master","muscle","red","strength","traffic","trip","vegetable","appeal","chart","gear","ideal","kitchen","land","log","mother","net","party","principle","relative","sale","season","signal","spirit","street","tree","wave","belt","bench","commission","copy","drop","minimum","path","progress","project","sea","south","status","stuff","ticket","tour","angle","blue","breakfast","confidence","daughter","degree","doctor","dot","dream","duty","essay","father","fee","finance","hour","juice","luck","milk","mouth","peace","pipe","stable","storm","substance","team","trick","afternoon","bat","beach","blank","catch","chain","consideration","cream","crew","detail","gold","interview","kid","mark","mission","pain","pleasure","score","screw","sex","shop","shower","suit","tone","window","agent","band","bath","block","bone","calendar","candidate","cap","coat","contest","corner","court","cup","district","door","east","finger","garage","guarantee","hole","hook","implement","layer","lecture","lie","manner","meeting","nose","parking","partner","profile","rice","routine","schedule","swimming","telephone","tip","winter","airline","bag","battle","bed","bill","bother","cake","code","curve","designer","dimension","dress","ease","emergency","evening","extension","farm","fight","gap","grade","holiday","horror","horse","host","husband","loan","mistake","mountain","nail","noise","occasion","package","patient","pause","phrase","proof","race","relief","sand","sentence","shoulder","smoke","stomach","string","tourist","towel","vacation","west","wheel","wine","arm","aside","associate","bet","blow","border","branch","breast","brother","buddy","bunch","chip","coach","cross","document","draft","dust","expert","floor","god","golf","habit","iron","judge","knife","landscape","league","mail","mess","native","opening","parent","pattern","pin","pool","pound","request","salary","shame","shelter","shoe","silver","tackle","tank","trust","assist","bake","bar","bell","bike","blame","boy","brick","chair","closet","clue","collar","comment","conference","devil","diet","fear","fuel","glove","jacket","lunch","monitor","mortgage","nurse","pace","panic","peak","plane","reward","row","sandwich","shock","spite","spray","surprise","till","transition","weekend","welcome","yard","alarm","bend","bicycle","bite","blind","bottle","cable","candle","clerk","cloud","concert","counter","flower","grandfather","harm","knee","lawyer","leather","load","mirror","neck","pension","plate","purple","ruin","ship","skirt","slice","snow","specialist","stroke","switch","trash","tune","zone","anger","award","bid","bitter","boot","bug","camp","candy","carpet","cat","champion","channel","clock","comfort","cow","crack","engineer","entrance","fault","grass","guy","hell","highlight","incident","island","joke","jury","leg","lip","mate","motor","nerve","passage","pen","pride","priest","prize","promise","resident","resort","ring","roof","rope","sail","scheme","script","sock","station","toe","tower","truck","witness","can","will","other","use","make","good","look","help","go","great","being","still","public","read","keep","start","give","human","local","general","specific","long","play","feel","high","put","common","set","change","simple","past","big","possible","particular","major","personal","current","national","cut","natural","physical","show","try","check","second","call","move","pay","let","increase","single","individual","turn","ask","buy","guard","hold","main","offer","potential","professional","international","travel","cook","alternative","special","working","whole","dance","excuse","cold","commercial","low","purchase","deal","primary","worth","fall","necessary","positive","produce","search","present","spend","talk","creative","tell","cost","drive","green","support","glad","remove","return","run","complex","due","effective","middle","regular","reserve","independent","leave","original","reach","rest","serve","watch","beautiful","charge","active","break","negative","safe","stay","visit","visual","affect","cover","report","rise","walk","white","junior","pick","unique","classic","final","lift","mix","private","stop","teach","western","concern","familiar","fly","official","broad","comfortable","gain","rich","save","stand","young","heavy","lead","listen","valuable","worry","handle","leading","meet","release","sell","finish","normal","press","ride","secret","spread","spring","tough","wait","brown","deep","display","flow","hit","objective","shoot","touch","cancel","chemical","cry","dump","extreme","push","conflict","eat","fill","formal","jump","kick","opposite","pass","pitch","remote","total","treat","vast","abuse","beat","burn","deposit","print","raise","sleep","somewhere","advance","consist","dark","double","draw","equal","fix","hire","internal","join","kill","sensitive","tap","win","attack","claim","constant","drag","drink","guess","minor","pull","raw","soft","solid","wear","weird","wonder","annual","count","dead","doubt","feed","forever","impress","repeat","round","sing","slide","strip","wish","combine","command","dig","divide","equivalent","hang","hunt","initial","march","mention","spiritual","survey","tie","adult","brief","crazy","escape","gather","hate","prior","repair","rough","sad","scratch","sick","strike","employ","external","hurt","illegal","laugh","lay","mobile","nasty","ordinary","respond","royal","senior","split","strain","struggle","swim","train","upper","wash","yellow","convert","crash","dependent","fold","funny","grab","hide","miss","permit","quote","recover","resolve","roll","sink","slip","spare","suspect","sweet","swing","twist","upstairs","usual","abroad","brave","calm","concentrate","estimate","grand","male","mine","prompt","quiet","refuse","regret","reveal","rush","shake","shift","shine","steal","suck","surround","bear","brilliant","dare","dear","delay","drunk","female","hurry","inevitable","invite","kiss","neat","pop","punch","quit","reply","representative","resist","rip","rub","silly","smile","spell","stretch","stupid","tear","temporary","tomorrow","wake","wrap","yesterday","Thomas","Tom","Lieuwe"]};

exports.svg = {
	options: {
		react: "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M12.2512 2.00309C12.1677 2.00104 12.084 2 12 2C6.477 2 2 6.477 2 12C2 17.522 6.477 22 12 22C17.523 22 22 17.522 22 12C22 11.916 21.999 11.8323 21.9969 11.7488C21.3586 11.9128 20.6895 12 20 12C15.5817 12 12 8.41828 12 4C12 3.31052 12.0872 2.6414 12.2512 2.00309ZM10 8C10 6.896 9.104 6 8 6C6.896 6 6 6.896 6 8C6 9.105 6.896 10 8 10C9.104 10 10 9.105 10 8ZM12 19C15.14 19 18 16.617 18 14V13H6V14C6 16.617 8.86 19 12 19Z\"></path><path d=\"M21 3V0H19V3H16V5H19V8H21V5H24V3H21Z\" fill=\"currentColor\"></path></svg>",
		
		edit: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M19.2929 9.8299L19.9409 9.18278C21.353 7.77064 21.353 5.47197 19.9409 4.05892C18.5287 2.64678 16.2292 2.64678 14.817 4.05892L14.1699 4.70694L19.2929 9.8299ZM12.8962 5.97688L5.18469 13.6906L10.3085 18.813L18.0201 11.0992L12.8962 5.97688ZM4.11851 20.9704L8.75906 19.8112L4.18692 15.239L3.02678 19.8796C2.95028 20.1856 3.04028 20.5105 3.26349 20.7337C3.48669 20.9569 3.8116 21.046 4.11851 20.9704Z\" fill=\"currentColor\"></path></svg>",
		
		delete: "<svg aria-hidden=\"false\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z\"></path><path fill=\"currentColor\" d=\"M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z\"></path></svg>",
	},
	channel: {
		friends: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><g fill=\"none\" fill-rule=\"evenodd\"><path fill=\"currentColor\" fill-rule=\"nonzero\" d=\"M0.5,0 L0.5,1.5 C0.5,5.65 2.71,9.28 6,11.3 L6,16 L21,16 L21,14 C21,11.34 15.67,10 13,10 C13,10 12.83,10 12.75,10 C8,10 4,6 4,1.5 L4,0 L0.5,0 Z M13,0 C10.790861,0 9,1.790861 9,4 C9,6.209139 10.790861,8 13,8 C15.209139,8 17,6.209139 17,4 C17,1.790861 15.209139,0 13,0 Z\" transform=\"translate(2 4)\"></path><path d=\"M0,0 L24,0 L24,24 L0,24 L0,0 Z M0,0 L24,0 L24,24 L0,24 L0,0 Z M0,0 L24,0 L24,24 L0,24 L0,0 Z\"></path></g></svg>",
		
		invite: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\"><path fill=\"currentColor\" d=\"M14 2H16V3H14V5H13V3H11V2H13V0H14V2Z\"></path><path fill=\"currentColor\" d=\"M6.5 8.00667C7.88 8.00667 9 6.88667 9 5.50667C9 4.12667 7.88 3.00667 6.5 3.00667C5.12 3.00667 4 4.12667 4 5.50667C4 6.88667 5.12 8.00667 6.5 8.00667Z\"></path><path fill=\"currentColor\" d=\"M6.5 8.34C3.26 8.34 1 9.98666 1 12.34V13.0067H12V12.34C12 9.98 9.74 8.34 6.5 8.34Z\"></path></svg>",
		
		rules: "<svg width=\"24\" height=\"24\" viewBox=\"0 0 40 40\" fill=\"none\"><path fill=\"currentColor\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M33 34.5833V7.49998H35V36.6666H9C6.791 36.6666 5 34.801 5 32.5V7.49998C5 5.19894 6.791 3.33331 9 3.33331H31V30.4166H9C7.8955 30.4166 7 31.3485 7 32.5C7 33.6515 7.8955 34.5833 9 34.5833H33ZM23.9718 9.99998L15.8889 17.9915L12.7086 14.8441L10 17.5058L15.8885 23.3333L26.6667 12.6669L23.9718 9.99998Z\"></path></svg>",
		
		normal: "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M5.887 21a.5.5 0 01-.493-.587L6 17H2.595a.5.5 0 01-.492-.586l.175-1A.5.5 0 012.77 15h3.58l1.06-6H4.005a.5.5 0 01-.492-.586l.175-1A.5.5 0 014.18 7h3.58l.637-3.587A.5.5 0 018.889 3h.984a.5.5 0 01.493.587L9.76 7h6l.637-3.587A.5.5 0 0116.889 3h.984a.5.5 0 01.493.587L17.76 7h3.405a.5.5 0 01.492.586l-.175 1A.5.5 0 0120.99 9h-3.58l-1.06 6h3.405a.5.5 0 01.492.586l-.175 1a.5.5 0 01-.492.414H16l-.637 3.587a.5.5 0 01-.492.413h-.984a.5.5 0 01-.493-.587L14 17H8l-.637 3.587a.5.5 0 01-.492.413h-.984zM9.41 9l-1.06 6h6l1.06-6h-6z\"></path></svg>",
	},
	
	home: "<svg aria-hidden=\"false\" width=\"28\" height=\"20\"><path fill=\"currentColor\" d=\"M20.6644 20s-.863-1.0238-1.5822-1.9286c3.1404-.8809 4.339-2.8333 4.339-2.8333-.9828.6429-1.9178 1.0953-2.7568 1.4048-1.1986.5-2.3493.8333-3.476 1.0238-2.3014.4286-4.411.3095-6.2089-.0238C9.61301 17.381 8.43836 17 7.45548 16.6191c-.55137-.2143-1.15069-.4762-1.75-.8095-.07192-.0477-.14384-.0715-.21575-.1191-.04795-.0238-.07192-.0476-.09589-.0714-.43151-.2381-.67124-.4048-.67124-.4048s1.15069 1.9048 4.19521 2.8095C8.19863 18.9286 7.31164 20 7.31164 20 2.0137 19.8333 0 16.381 0 16.381 0 8.7144 3.45205 2.50017 3.45205 2.50017 6.90411-.07123 10.1884.0001979 10.1884.0001979l.2397.2857111C6.11301 1.52399 4.12329 3.40493 4.12329 3.40493s.52739-.28572 1.41438-.69047C8.10274 1.59542 10.1404 1.2859 10.9795 1.21447c.1438-.02381.2637-.04762.4075-.04762 1.4623-.190471 3.1164-.23809 4.8425-.04762 2.2773.26191 4.7226.92857 7.2157 2.2857 0 0-1.8938-1.7857-5.9692-3.023784l.3356-.3809481S21.0959-.07123 24.5479 2.50017c0 0 3.4521 6.21423 3.4521 13.88083 0 0-2.0377 3.4523-7.3356 3.619zM9.51712 8.88106c-1.36644 0-2.4452 1.19044-2.4452 2.64284 0 1.4524 1.10274 2.6428 2.4452 2.6428 1.36648 0 2.44518-1.1904 2.44518-2.6428.024-1.4524-1.0787-2.64284-2.44518-2.64284zm8.74998 0c-1.3664 0-2.4452 1.19044-2.4452 2.64284 0 1.4524 1.1028 2.6428 2.4452 2.6428 1.3665 0 2.4452-1.1904 2.4452-2.6428s-1.0787-2.64284-2.4452-2.64284z\"/></svg>",
	
	emoji_search: "<svg width='18' height='18'><path d='M3.6 7.203a3.597 3.597 0 013.603-3.602 3.597 3.597 0 013.602 3.602 3.597 3.597 0 01-3.602 3.602 3.597 3.597 0 01-3.602-3.602zm8.406 3.602h-.633l-.224-.216a5.18 5.18 0 001.257-3.386 5.203 5.203 0 10-5.203 5.203 5.18 5.18 0 003.386-1.257l.216.224v.633L14.807 16 16 14.807l-3.79-3.797-.204-.205z' fill-rule='evenodd' aria-hidden='true'/></svg>",
	
	toggle: '<svg class="toggle" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M16.59 8.59004L12 13.17L7.41 8.59004L6 10L12 16L18 10L16.59 8.59004Z"></path></svg>',
	
	toggle2: '<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M16.59 8.59004L12 13.17L7.41 8.59004L6 10L12 16L18 10L16.59 8.59004Z\"></path></svg>',
	
	gears: "<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M19.738 10H22V14H19.739C19.498 14.931 19.1 15.798 18.565 16.564L20 18L18 20L16.565 18.564C15.797 19.099 14.932 19.498 14 19.738V22H10V19.738C9.069 19.498 8.203 19.099 7.436 18.564L6 20L4 18L5.436 16.564C4.901 15.799 4.502 14.932 4.262 14H2V10H4.262C4.502 9.068 4.9 8.202 5.436 7.436L4 6L6 4L7.436 5.436C8.202 4.9 9.068 4.502 10 4.262V2H14V4.261C14.932 4.502 15.797 4.9 16.565 5.435L18 3.999L20 5.999L18.564 7.436C19.099 8.202 19.498 9.069 19.738 10ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z\"></path></svg>",
	close: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z\"></path></svg>",
	close_dm: "<svg aria-hidden=\"false\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z\"></path></svg>",
	accept: "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M8.99991 16.17L4.82991 12L3.40991 13.41L8.99991 19L20.9999 7.00003L19.5899 5.59003L8.99991 16.17Z\"></path></svg>",
	
	message: "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\"><path fill=\"currentColor\" d=\"M4.79805 3C3.80445 3 2.99805 3.8055 2.99805 4.8V15.6C2.99805 16.5936 3.80445 17.4 4.79805 17.4H7.49805V21L11.098 17.4H19.198C20.1925 17.4 20.998 16.5936 20.998 15.6V4.8C20.998 3.8055 20.1925 3 19.198 3H4.79805Z\"></path></svg>",
};

exports.typing = [
	'',
	'{typers} is typing...',
	'{typers} are typing...',
	'{typers} are typing...',
	'Several people are typing...',
];

/***/ }),

/***/ "./libs/CDN.js":
/*!*********************!*\
  !*** ./libs/CDN.js ***!
  \*********************/
/***/ ((module) => {



class CDN {
	hosts = [
		'images-ext-1.discordapp.net',
		'images-ext-2.discordapp.net',
		'discord.com',
		'discordapp.com',
		'media.discordapp.net',
		'cdn.discordapp.com',
		'twemoji.maxcdn.com',
	];
	resolve(index){
		if(!this.hosts[index])throw 'Bad index';
		
		return this.hosts[index];
	}
	url(url){
		url = new URL(url);
		
		return 'media?cdn=' + this.resolve_index(url.host) + '&path=' + encodeURIComponent(url.pathname);
	}
	resolve_index(host){
		if(!this.hosts.includes(host))throw 'Bad CDN';
		return this.hosts.indexOf(host);
	}
};

module.exports = CDN;

/***/ }),

/***/ "./libs/Events.js":
/*!************************!*\
  !*** ./libs/Events.js ***!
  \************************/
/***/ ((module) => {



var original_func = Symbol(),
	listeners = Symbol(),
	resolve_list = (target, event) => {
		var events = (target[listeners] || (target[listeners] = {}))[event] || (target[listeners][event] = []);
		
		if(!events.merged){
			events.merged = true;
			
			if(target.constructor.hasOwnProperty(listeners))events.push(...resolve_list(target.constructor, event));
		}
		
		return events;
	};

class Events {
	on(event, callback){
		resolve_list(this, event).push(callback);
	}
	once(event, callback){
		var cb = (...data) => {
			this.off(event, cb);
			callback.call(this, ...data)
		};
		
		cb[original_func] = callback;
		
		this.on(event, callback);
	}
	off(event, callback){
		if(typeof callback != 'function')throw new Error('callback is not a function');
		
		if(callback[original_func])callback = callback[original_func];
		
		var list = resolve_list(this, event), ind = list.indexOf(callback);
		
		if(ind != -1)list.splice(ind, 1);
		
		if(!list.length)delete this[listeners][event];
	}
	emit(event, ...data){
		var list = resolve_list(this, event);
		
		if(!list.length){
			delete this[listeners][event];
			if(event == 'error')throw data[0];
		}else for(var item of list)try{
			item.call(this, ...data);
		}catch(err){
			this.emit('error', err);
		}
	}
};

var resolve_args = args => {
	var callback = args.findIndex(arg => typeof arg == 'function');
	
	return {
		label: args.find(arg => typeof arg == 'string'),
		callback: args[callback],
		expects: callback == 0 ? [] : args[0],
	};
};

var wrap_type = (event, args, type = 'on') => {
	var rargs = resolve_args(args);
	
	if(!rargs.callback)throw new Error('Callback not specified');
	
	return Object.assign(async function(...data){
		var return_id = type == 'get' && data.splice(0, 1)[0];
		
		if(rargs.expects.every((type, ind) => type == 'unknown' || (Array.isArray(data[ind]) ? 'array' : typeof data[ind]) == type)){
			// resolve, reject
			if(return_id){
				try{
					var data = await rargs.callback.call(this, ...data);
					this.send(return_id, 0, data);
				}catch(err){
					if(err instanceof Error){
						console.error('node error:', err);
						
						err = {};
					}
					
					this.send(return_id, 1, err);
				}
			}else{
				rargs.callback.call(this, ...data);
			}
		}else console.error(`Skip ${event}
Expect: ${rargs.expects.join(', ')}
Got   : ${rargs.expects.map((type, ind) => Array.isArray(data[ind]) ? 'array' : typeof data[ind]).join(', ')}
Data  : ${data.join(', ')}`);
	}, {
		[original_func]: rargs.callback,
	});
};

class EventsType extends Events {
	on(event, ...args){
		super.on(event, wrap_type(event, args));
	}
	once(event, ...args){
		super.once(event, wrap_type(event, args));
	}
	get(event, ...args){
		super.on(event, wrap_type(event, args, 'get'));
	}
};

Events.Type = EventsType;
Events.listeners = listeners;
module.exports = Events;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!*************************!*\
  !*** ./client/index.js ***!
  \*************************/


var { socket, nodes } = __webpack_require__(/*! ./libs/constants */ "./client/libs/constants.js"),
	assets = __webpack_require__(/*! ../data/assets */ "./data/assets.js");

socket.on('open', () => {
	(localStorage.getItem('token') ? socket.get('token', JSON.parse(localStorage.getItem('token'))) : Promise.reject()).catch(() => new Promise(resolve => {
		var form =  new Discord.Form('Signup or login to Chatutils', 'Enter an email and password.', 'This is NOT your Discord login', false),
			email = new Discord.Form.Input(form, 'Email', 'email', 'doga1tap@gmail.com'),
			pass = new Discord.Form.Input(form, 'Password', 'password', 'test1234'),
			signup = new Discord.Form.Button(form, 'Signup', true),
			login = new Discord.Form.Button(form, 'Login', true);
		
		form.on('submit', detail => {
			detail.prevent_default();
			
			socket.get(detail.node == signup.main ? 'signup' : 'login', email.value, pass.value).then(token => {
				form.close();
				
				localStorage.setItem('token', JSON.stringify(token));
				
				resolve();
			}).catch(err => form.error(err));
		});
	})).finally(() => {
		
	});
});

socket.once('open', () => {
	// reconnected
	socket.on('open', () => socket.emit('reconnected'));
});

socket.on('close', () => socket.connect(socket.url));

socket.connect('ws' + (location.protocol == 'http:' ? '' : 's') + '://' + location.host);

var DOM = __webpack_require__(/*! ./libs/DOM */ "./client/libs/DOM.js"),
	gen_uuid = () => [...Array(4)].map(() => {
		var d0 = Math.random() * 0xffffffff | 0;
		return ('' + (d0 & 0xff).toString(16)).padStart(2, 0) + ('' + (d0 >> 8 & 0xff).toString(16)).padStart(2, 0) + ('' + (d0 >> 16 & 0xff).toString(16)).padStart(2, 0) + ('' + (d0 >> 24 & 0xff).toString(16)).padStart(2, 0)
	}).join('-').toUpperCase(),
	Discord = __webpack_require__(/*! ./libs/Discord */ "./client/libs/Discord/index.js"),
	client = new Discord.Client();

socket.on('message', data => client.handle_message(data));

socket.on('message_delete', (channel, id) => {
	var channel = client.channels.get(channel),
		content = channel ? channel.contents.get(id) : null;
	
	if(content)content.delete(false, true);
});

socket.on('message_update', data => {
	var channel = client.channels.get(data.channel),
		content = channel ? channel.contents.get(data.id) : null;
	
	if(content)content.construct(channel.can_scroll(), data);
});

socket.on('message_react', (channel, id, reactions) => {
	var channel = client.channels.get(channel),
		content = channel ? channel.contents.get(id) : null;
	
	if(content)content.reactions(reactions);
});

socket.on('reconnected', () => client.channels.forEach(channel => {
	if(channel.active)channel.fetch_messages();
}));

// runs after meta stuff is set and goes to guild (on first load)
var initial_guild;

socket.on('meta', guilds => {
	client.guilds.forEach(guild => guild.delete());
	
	guilds.forEach((data, ind) => {
		var guild = new Discord.Guild(client, data),
			menu = DOM.add_ele('div', guild.sidebar.channels, { className: 'channel-menu' });
		
		DOM.add_ele('raw', menu, {
			html: assets.svg.channel.invite,
			className: 'icon',
		});
		
		DOM.add_ele('div', menu, { className: 'label', innerHTML: 'Join the Discord' });
		
		menu.addEventListener('click', () => socket.get('invite', guild.id).then(code => {
			if(document.querySelector('[data-title*="Invite"]'))return;
			
			var form = new Discord.Form('Invite generated'),
				code_input = new Discord.Form.Input(form, 'Code', '', 'discord.gg/' + code),
				close = new Discord.Form.Button(form, 'Close'),
				open = new Discord.Form.Button(form, 'Open', true);
			
			open.addEventListener('click', () => (form.close(), window.open('https://discord.com/invite/' + code)));
		}));
	});
	
	if(client.channels.has(client.last_channel))client.channels.get(client.last_channel).show();
	else client.guilds.forEach(guild => guild.id == '735331808450969600' && guild.show());
});

socket.on('user', (data, locked) => {
	client.user = data;
	client.locked = locked;
	
	client.update();
});
socket.on('action', (type, val, nonce) => {
	switch(type){
		case'reload':
			socket.disconnect();
			window.location.reload();
			break
		case'redirect':
			window.location.href = val;
			break
		default:
			break;
	}
});

socket.on('typing', typing => Object.entries(typing).forEach(data => {
	var id = data[0],
		typers = data[1],
		channel = client.channels.get(id);
	
	if(!channel)return;
	
	channel.typers.innerHTML = assets.typing[ typers.length >= 4 ? 4 : typers.length ].replace(/{typers}/g, Object.values(typers).map(typer => '<span>' + typer.name + '</span>').join(' and '));
	
	channel.typing_box.style.opacity = typers.length ? 1 : 0;
}));

socket.on('info', data => new Discord.Popup({
	title: data.title,
	content: data.content,
	expires: 3000,
	closeable: true,
}));

document.body.addEventListener('keydown', event => {
	if(!document.activeElement || document.activeElement && document.activeElement.nodeName != 'INPUT' && !event.ctrlKey && !event.shiftKey){
		var found;
		
		for(var channel of client.channels)if(channel.active && channel.input)channel.input.bar.focus();
	}
});
})();

/******/ })()
;