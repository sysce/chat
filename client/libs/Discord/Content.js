'use strict';

var DOM = require('../DOM'),
	{ socket, obv, cdn } = require('../constants'),
	assets = require('../../../data/assets'),
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