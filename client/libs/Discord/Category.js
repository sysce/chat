'use strict';

var assets = require('../../../data/assets'),
	DOM = require('../DOM');

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