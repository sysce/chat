'use strict';

class Snowflake {
	static epoch = 1420070400000;
	static inc = 0;
	static generate(timestamp = Date.now()) {
		if(timestamp instanceof Date)timestamp = timestamp.getTime();
		if(this.inc >= 4095)this.inc = 0;
		
		return BigInt(parseInt(`${(timestamp - this.epoch).toString(2).padStart(42, '0')}0000100000${(this.inc++).toString(2).padStart(12, '0')}`, 2)).toString();
	}
	constructor(snowflake){
		var bin = this.binary = snowflake.toString(2).padStart(64, 0);
		
		this.timestamp = parseInt(bin.substring(0, 42), 2) + this.constructor.epoch;
		this.workerID = parseInt(bin.substring(42, 47), 2);
		this.processID = parseInt(bin.substring(47, 52), 2);
		this.increment = parseInt(bin.substring(52, 64), 2);
		this.date = new Date(this.timestamp);
	}
};

module.exports = Snowflake;