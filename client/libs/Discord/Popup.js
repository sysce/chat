'use strict';

var DOM = require('../DOM'),
	{ nodes } = require('../constants');

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