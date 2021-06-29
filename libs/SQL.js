'use strict';

var sqlite3 = require('sqlite3').verbose();

class SQL {
	constructor(...args){
		var callback = typeof args.slice(-1)[0] == 'function' && args.splice(-1)[0];
		
		this.ready = new Promise((resolve, reject) => {
			this.db = new sqlite3.Database(...args, err => {
				var ind = this.wqueue.unknown.indexOf(this.ready);
				
				if(ind != -1)this.wqueue.unknown.splice(ind, 1);
				
				if(err)reject(err);
				else resolve();
			});
			
			this.wqueue = { unknown: [ this.ready ] };
		}).catch(err => {
			console.error('DB ERROR:', err);
			
			process.exit();
		});
	}
	promisify(prop, [ query, ...args ]){
		var	split = query.split(' '),
			table = split.indexOf('from');
		
		if(table == -1)table = split.indexOf('into');
		
		if(table != -1)table = split[table + 1];
		else table = 'unknown';
		
		if(!this.wqueue[table])this.wqueue[table] = [];
		
		var promise = new Promise((resolve, reject) => Promise.allSettled(this.wqueue[table]).then(() => {
			var start = Date.now(), time;
			
			this.db[prop](query, ...args, (err, row, ind) => ((ind = this.wqueue[table].indexOf(promise)) != -1 && this.wqueue[table].splice(ind, 1), err ? reject(err) + console.error(query, '\n', err) : resolve(row)));
			
			time = Date.now() - start;
			
			if(time > 100)console.log(query + '\ntook ' + time + 'ms to execute, consider optimizing');
		}));
		
		this.wqueue[table].push(promise);
		
		return promise;
	}
	get(...args){
		return this.promisify('get', args);
	}
	all(...args){
		return this.promisify('all', args);
	}
	run(...args){
		return this.promisify('run', args);
	}
};

module.exports = SQL;