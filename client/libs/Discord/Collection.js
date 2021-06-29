'use strict';

class Collection extends Map {
	first(){
		return [...this.values()][0];
	}
	last(){
		var values = [...this.values()];
		
		return values[values.length - 1];
	}
}

module.exports = Collection;