'use strict';

var path = require('path'),
	config = require('../config.json'),
	Bot = require('../libs/Bot'),
	IP = require('../libs/IP'),
	SQL = require('../libs/SQL'),
	CDN = require('../libs/CDN');

exports.cdn = new CDN();

exports.bot = new Bot();

exports.ip = new IP(path.join(__dirname, 'ip2asn.tsv'));

exports.config = config;
exports.production = config.production;

exports.perms = config.perms;

exports.db = new SQL(path.join(__dirname, 'data.db'));

console.log('Connecting to DB..');
exports.db.ready.then(() => {
	console.log('Connected to DB');
});

exports.ClassError = class extends Error {
	static name = 'ClassError';
	constructor(...args){
		super(...args);
	}
}

exports.log = err => !(err instanceof exports.ClassError) && console.error(err);