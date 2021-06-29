'use strict';

var DOM = require('../DOM'),
	assets = require('../../../data/assets'),
	Channel = require('./Channel'),
	{ cdn, nodes } = require('../constants');

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