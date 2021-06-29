'use strict';

var path = require('path'),
	webpack = require('webpack'),
	{ config } = require('./data/constants'),
	errors = (err, stats = { compilation: { errors: [] } }) => {
		var error = !!(err || stats.compilation.errors.length);
		
		for(var ind = 0; ind < stats.compilation.errors.length; ind++)error = true, console.error(stats.compilation.errors[ind]);
		
		if(err)console.error(err);
		
		return error;
	};

var compiler = webpack({
	entry: path.join(__dirname, 'client', 'index.js'),
	output: {
		path: path.join(__dirname, 'public'),
		filename: 'index.js',
	},
	devtool: false,
	mode: config.production ? 'production' : 'development',
}, (err, stats) => {
	if(errors(err, stats))return;
	
	compiler.watch({}, (err, stats) => {
		if(errors(err, stats))console.error('Build fail');
		else console.log('Build success');
	});
});
