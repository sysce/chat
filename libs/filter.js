// Proprietary filter used in chatutils
'use strict';

var fs = require('fs'),
	path = require('path'),
	chatutils_assets = path.join(__dirname, '..', 'data', 'assets.json');

/**
* Filter class
* @param {String} Input text to process
* @example
* var result = new(require('/path/to/filter.js'))('Niggle');
* 
* console.log(result); // {
*   variants: { 'rule 5': 'niggle', 'rule 8': 'niggle', 'rule 6': 'niggle', link: 'niggle', invite: 'niggle', slur: 'niggie' },
*   matches: { 'rule 5': null, 'rule 8': false, 'rule 6': false, link: null, invite: null, slur: [ 'nigg' ] },
*   string: 'niggle', match: [ 'slur', [ 'nigg' ] ]
* }
* console.log(result.toString()); // [slur]
*/

module.exports = class {
	// Transform :emoji_name: into the unicode emoji variant (from assets)
	static emojis_flat = fs.existsSync(chatutils_assets) ? Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(chatutils_assets, 'utf8')).emojis).flatMap(([ key, val ]) => Object.entries(val).map(([ key, val ]) => [ key, String.fromCodePoint(...val) ]))) : {};
	static filters = [{
		pre: str => str.replace(module.exports.regex.alt_period, '.'),
		label: 'rule 5',
		regex: new RegExp(/([.,\-*:]|[(\[]?d+o*t?s?[)\]]|\s)\s*/.source + '(' + ['com','net','design','ga','ml','cf','gq','tk', 'xyz'].map(tld => tld.split('').map((char, ind, arr) => ind != arr.length - 1 ? char + '\\s*?' : char).join('')).join('|') + ')' + /(?![el])(\s*?)(\s|$|(?!y)(?![a-z]{2}))/.source, 'gi'),
	},{
		label: 'rule 8',
		regex: /g+a+y+/gi,
	},{
		label: 'rule 8',
		words: ['gay', 'homo', 'bisexual', 'gаy', 'transgender', 'trans', 'faggot', 'asexual', 'pansexual', 'homosexual', 'lesbian', ':two_men_holding_hands:', ':rainbow_flag:'],
	},{
		label: 'rule 6',
		words: ['biden', 'trump', 'blm'],
	},{
		pre: str => str.replace(module.exports.regex.space, ''),
		label: 'link',
		regex: /https?:\/|\w+:\/{2}/g,
	},{
		label: 'invite',
		regex: /discord[\._\s]?gg|\.gg[\/\s]/g,
	},{
		pre: str => str.replace(module.exports.regex.space, '').replace(module.exports.regex.alt_g, 'g').replace(module.exports.regex.alt_e, 'e').replace(module.exports.regex.alt_i, 'i').replace(module.exports.regex.non_char, '').replace(module.exports.regex.alt_period, '.'),
		label: 'slur',
		regex: /ni{2,}g+e+r|ning+er|nuger|nigg|(?<![rbg])[nbi]g{2,}(?![ay])(?:er|(?<!.{3})r)|(?<!e)([nb](?!age)[ia]+(?:g{2,}|g+)|ni+g{2,})(?<!nag)[^eo]{0,1}(?<!nag|t)((?<!g)a|(?<!i)r(?![emn])|er)|nig{2,}l?e|niga(?![n])|niger|neg+ro|kne+grow|nice\s*?car/g,
	},{
		label: 'slur',
		words: [ '[slur]', 'kkk' ],
	}]
	static regex = {
		emoji: /<\S+:\d+:>/g,
		emoji_message: /:([a-z_]+):/gi,
		alt_g: /[qgb6]/g,
		alt_e: /[3]/g,
		alt_period: /[-+,()@#$%^*?&.:]/g,
		alt_i: /[2l!1:;]/g,
		mention: /<@([\s\S]*?)>/gi,
		char: /\D/g,
		non_char: /[^a-z0-9]/gi,
		non_char1: /[^a-z\s]/gi,
		non_ascii: /[^\x01-\x7F]+/g,
		ping: /@(everyone|here)/g,
		space: /\s/g,
		whitespace: /\s+/g,
	}
	constructor(string){
		this.variants = {};
		this.matches = {};
		this.string = '';
		
		if(Array.isArray(string))string = string.join(' ');
		
		// convert to string
		string = string + '';
		
		string.split('').forEach((entry, index) => {
			var check = string.substr(index - 2, index + 2),
				chr = string.charCodeAt(index);
			
			if(chr >= 0 && chr <= 126)this.string += string.charAt(index);
		});
		
		this.string = this.string.replace(module.exports.regex.non_ascii, '').replace(module.exports.regex.mention, '[MENTION]').replace(module.exports.regex.emoji_message, (match, name) => module.exports.emojis_flat[name] || '').replace(module.exports.regex.emoji, '[EMOJI]').replace(module.exports.regex.ping, '[PING]').substr(0, 200).trim();
		
		for(var val of module.exports.filters){
			var str = this.string.toLowerCase();
			
			this.variants[val.label] = typeof val.pre == 'function' ? val.pre(str) : str;
			
			this.matches[val.label] = val.words ? this.variants[val.label].replace(module.exports.regex.non_char1, '').split(' ').some(word => val.words.includes(word)) : this.variants[val.label].match(val.regex);
			
			this.match = (this.match || !this.matches[val.label]) ? this.match : [ val.label, this.matches[val.label] ];
		}
	}
	/**
	* Will return the detected filter data wrapped in brackets
	* @returns {String} - [slur], [rule 5], etc..
	*/
	toString(){
		return this.match ? '[' + this.match[0] + ']' : this.string;
	}
}