'use strict';

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