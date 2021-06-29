'use strict';

var DOM = require('../DOM'),
	{ cdn, socket, obv } = require('../constants'),
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