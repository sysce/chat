'use strict';

var DOM = require('./DOM'),
	CDN = require('../../libs/CDN'),
	Socket = require('./Socket');

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