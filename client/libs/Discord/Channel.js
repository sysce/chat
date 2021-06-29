'use strict';

var DOM = require('../DOM'),
	assets = require('../../../data/assets'),
	{ cdn, socket } = require('../constants'),
	Category = require('./Category'),
	Form = require('./Form'),
	Collection = require('./Collection');

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