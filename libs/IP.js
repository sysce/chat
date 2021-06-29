'use strict';

var fs = require('fs'),
	zlib = require('zlib'),
	fetch = require('node-fetch');

class IP {
	day = 1000 * 60 * 60 * 24;
	constructor(file, cache = false){
		this.file = file;
		this.cache = !!cache;
		
		this.ranges = {
			ipv4: [],
			ipv6: [],
		};
		
		this.banned = [
			{ type: 'keyword', data: 'kamatera inc' },
			{ type: 'keyword', data: 'cellco' },
			{ type: 'keyword', data: 'onion' },
			{ type: 'keyword', data: 'cloudwebmanage' },
			{ type: 'keyword', data: 'SWAN, a.s.' },
			{ type: 'keyword', data: 'hosting' },
			{ type: 'keyword', data: 'e.V.' },
			{ type: 'keyword', data: 'Markus Koch' },
			{ type: 'keyword', data: 'ovh' },
			{ type: 'keyword', data: 'PONYNET' },
			{ type: 'keyword', data: 't-mobile' },
			{ type: 'keyword', data: 'privacy' },
			{ type: 'keyword', data: 'SUPERNet' },
			{ type: 'keyword', data: 'DISTRICT-OF-PALM-BEACH-COUNTY' },
			{ type: 'exact', data: 'google' },
			{ type: 'keyword', data: 'hetzner' },
			{ type: 'keyword', data: 'kamatera' },
			{ type: 'keyword', data: 'CLOUDWEBMANAGE' },
			{ type: 'keyword', data: 'DigitalOcean' },
			{ match: 'asn', data: 7018 },
			{ match: 'asn', data: 394607 },
			{ match: 'asn', data: 37529 },
			{ match: 'asn', data: 202015 },
			{ match: 'asn', data: 204949 },
			{ match: 'asn', data: 36007 },
		];
		
		this.retrieve();
		// fs.promises.access(path).catch(() => this.request()).finally(() => this.load());
	}
	in_range(parsed, range){
		return parsed.every((val, ind) => (range.start[ind] == null || val >= range.start[ind]) && (range.end[ind] == null || val <= range.end[ind]));
	}
	is_ipv6(ip){
		return ip.includes(':');
		// return '255.255.255.255'.length < ip.length,;
	}
	lookup(ip){
		var ipv6 = this.is_ipv6(ip),
			ipv = 'ipv' + (ipv6 ? 6 : 4),
			parsed_ip = this['parse_' + ipv](ip);
		
		for(var range of this.ranges[ipv])if(this.in_range(parsed_ip, range))return this.expand(range, ip);
		// else if(ipv6 && range.end_original.startsWith('2601:601'))console.log('LOOKING:', ip, '\nORIGINAL START:', range.start_original, '\nORIGINAL END  :', range.end_original);
		
		return { ip: ip, error: true };
	}
	expand(range, ip){
		return {
			ip: ip,
			aso: range.aso,
			asn: range.asn,
			vpn: this.banned.some(filter => filter.match == 'asn' ? range.asn == filter.data : filter.type == 'keyword' ? range.aso.toLowerCase().includes(filter.data.toLowerCase()) : range.aso == filter.data.toLowerCase()),
		};
	}
	parse_ipv4(ip){
		var arr = new Uint8Array(4);
		
		arr.set(ip.split('.').map(part => parseInt(part)));
		
		return arr;
	}
	parse_ipv6(ip){
		var arr = new Uint16Array(8).fill(0);
		
		arr.set(ip.split(':').map(part => parseInt(part, 16)));
		
		return arr;
	}
	// this.parse((await fs.promises.readFile(this.path)).toString());
	parse(data){
		for(var line of data.toString().split('\n')){
			var [ range_start, range_end, asn, country_code, aso ] = line.split('\t');
			
			if(!range_start || !range_end)continue;
			
			var ipv6 = this.is_ipv6(range_start),
				ipv = 'ipv' + (ipv6 ? 6 : 4);
			
			if(range_start.endsWith('::'))range_start = range_start.slice(0, -2);
			
			this.ranges[ipv].push({
				start_original: range_start,
				end_original: range_end,
				start: this['parse_' + ipv](range_start),
				end: this['parse_' + ipv](range_end),
				asn: asn,
				aso: aso,
				country: country_code,
			});
		}
		
		console.log(this.lookup('2601:601:100:c100:38b6:913f:f01c:d1e5'));
		console.log(this.lookup('73.250.49.211'));
	}
	ungz(data){
		return new Promise((resolve, reject) => zlib.gunzip(data, (err, data) => {
			if(err)return reject(err);
			
			resolve(data);
		}));
	}
	async request(){
		return await this.ungz(await(await fetch('https://iptoasn.com/data/ip2asn-combined.tsv.gz')).buffer());
	}
	async retrieve(){
		this.cache = true;
		
		if(this.cache)await fs.promises.stat(this.file).then(async stats => {
			var days_old = Math.abs(stats.mtimeMs - Date.now()) / this.day;
			
			if(days_old <= 1)throw new Error('Update');
			else await this.parse(await fs.promises.readFile(this.file));
		}).catch(async err => {
			var data = await this.request();
			
			await fs.promises.writeFile(this.file, data);
			await this.parse(data);
		});
		else this.parse(await this.request());
	}
};

module.exports = IP;