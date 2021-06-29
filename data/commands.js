'use strict';
var filter = require('../libs/filter'),
	{ bot, ip, production } = require('../data/constants.js'),
	cooldowns = {};

bot.on('message', async message => {
	var args = message.content.trim().replace(/\s+/g, ' ').split(' '),
		perms = bot.perms(message.member);
	
	if(message.user)perms = user.perms;
	
	if(perms.owner)perms.admin = true;
	if(perms.admin || message.member && message.member.hasPermission(['ADMINISTRATOR','MANAGE_GUILD','MANAGE_WEBHOOKS','KICK_MEMBERS', 'BAN_MEMBERS']))perms.mod = true;
	if(perms.mod)perms.helper = true;
	if(perms.helper)perms.staff = true;
	
	if(!message.author.bot && message.member && !perms.helper){
		var filtered = new filter(message.cleanContent);
		
		if(filtered.match && ['rule 8', 'rule 6', 'slur', 'invite'].includes(filtered.match[0]) && production){
			setTimeout(() => message.delete(), 200);
			
			var webhooks = await message.channel.fetchWebhooks();
			
			webhook = webhooks.first();
			
			if(!webhook)webhook = await message.channel.createWebhook('chatutils');
			
			webhook.send(filtered.toString(), {
				username: message.member ? message.member.displayName : message.author.username,
				avatarURL: message.author.avatarURL({ format: 'webp', dynamic: true, size: 32 }) || message.author.defaultAvatarURL,
			});
		}
	}
	
	for(var command of exports.commands)if((production ? command.alias : command.alias.map(alias => 'd' + alias)).includes(args[0])){
		if(!cooldowns[message.author.id])cooldowns[message.author.id] = {};
		
		var cooldown = {
				start: Date.now(),
				duration: command.cooldown || 2500,
			},
			active_cd = cooldowns[message.author.id] ? cooldowns[message.author.id][command.alias[0]] : false;
		
		if(active_cd && Date.now() - active_cd.start >= active_cd.duration){
			active_cd = false;
			delete cooldowns[message.author.id][command.alias[0]];
		}
		
		if(active_cd)return message.channel.send('You are on cooldown, please wait **' + (active_cd.duration / 1000) + 's**');
		
		cooldowns[message.author.id][command.alias[0]] = cooldown;
		
		// missing perm
		if(command.perm && !perms[command.perm])return message.channel.send(':no_entry: | Command requires ' + command.perm);
		
		if(!perms.mod && !command.bot_usage && message.author.bot)return;
		
		var flags = new Map(), first_flag;
		
		args.forEach((arg, ind) => {
			// flag cannot be the first argument
			if(!ind || !arg.startsWith('?'))return;
			
			first_flag = first_flag || ind;
			
			var next = args.findIndex((arg, inde) => inde > ind && arg.startsWith('?'));
			
			flags.set(arg.substr(1), args.slice(ind + 1, next == -1 ? args.length : next).join(' '));
		});
		
		var value = args.slice(1, flags.size ? first_flag : args.length).join(' '),
			ovalue = value;
		
		if(!value && command.value_user)return message.channel.send(':no_entry: | Specify a user discriminator.');
		
		if(command.value_user)value = await User.resolve_discrim(value).catch(err => false);
		
		if(!value && command.value_user)return message.channel.send(':no_entry: | User with discriminator ' + ovalue + ' not found.');
		
		try{
			command.value(message, value, flags, perms);
		}catch(err){
			console.error(err);
			message.channel.send(':no_entry_sign: | An error occured.');
		}
		
		break;
	}
});

exports.commands = [
	{
		infor: 'Gives information about specified user',
		alias: [ '_lookup', '_lu' ],
		perm: 'helper',
		value_user: true,
		async value(message, user, flags, perms){
			var similar = await db.all('select * from users where discrim != ? and ip = ?', user.discrim, user.raw_ip).then(users => Promise.all(users.map(user => User.resolve_active_user(user)))).then(users => users.map(user => user.tag + (user.punish ? ' **[' + (user.punish[0] == 'mute' ? 'MUTED' : user.punish[0] == 'ipban' ? 'IP-BANNED' : 'BANNED') + ']**' : '')).join('\n')),
				fields = [{
					name: 'Joined:',
					value: new Date(user.signup).toGMTString(),
					inline: false,
				},{
					name: 'Status:',
					value: user.punish ? (user.punish[0] == 'mute' ? 'Muted' : user.punish[0] == 'ipban' ? 'IP-Banned' : 'Banned') + ', <@' + user.punish[1] + '>, ' + user.punish[2] : 'None',
					inline: true,
				},{
					name: 'Staff:',
					value: user.uperms.staff ? 'Yes' : 'No',
					inline: true,
				},{
					name: 'Cases (' + user.cases.length + ', showing last 10):',
					value: user.cases.length ? user.cases.slice(-10).map(data => '**[' + data[0].toUpperCase() + ']** ' + '<@' + data[1] + '> : ' + new Date(data[3] || Date.now()).toGMTString() + ' : ' + data[2]).join('\n') : 'User has a clean state.',
					inline: false,
				},{
					name: 'Similar accounts' + (similar.length > 1000 ? ' (truncated from ' + similar.length + ' to 1000)' : '') + ':',
					// add user.status? only if used a lot
					value: similar.substr(0, 1000) || 'None found.',
					inline: true,
				}],
				ip_info = ip.lookup(user.raw_ip);
			
			if(flags.has('ip') && perms.admin)fields.push({
				name: 'IP:',
				value: '``' + ip_info.ip + '``',
				inline: false,
			},{
				name: 'ASN',
				value: '```' + ip_info.asn + '```',
				inline: false,
			},{
				name: 'ASO',
				value: '```' + ip_info.aso + '```'.toLowerCase(),
				inline: false,
			});
			
			message.channel.send({ embed: { title: user.tag, fields: fields } });
		},
	},
	{
		alias: [ '_wperms' ],
		infor: 'Views a webhook\'s permissions',
		perm: 'mod',
		value_user: true,
		value(message, user, flags){
			message.channel.send('Permissions for **' + user.discrim + '**:\n' + Object.entries(user.uperms).map(([ key, val ]) => key + ': ' + (val ? ':white_check_mark:' : ':no_entry:')).join('\n'));
		},
	},
	{
		alias: [ '_ban', '_b' ],
		infor: 'Bans specified user',
		perm: 'mod',
		value_user: true,
		value(message, user, flags){
			var reason = flags.get('r') || flags.get('reason') || 'No reason specified..';
			
			if(!reason)return message.channel.send(':no_entry: | Specify a reason.');
			
			try{
				user.ban(message.author.id, reason);
				message.channel.send('User ' + JSON.stringify(user.discrim) + ' banned.');
			}catch(err){
				if(err instanceof classes.error)message.channel.send(':no_entry: | ' + err.message);
				else throw err;
			}
		},
	},
	{
		alias: [ '+ban', '+b', '_ub' ],
		infor: 'Unbans specified user',
		perm: 'mod',
		value_user: true,
		value(message, user, flags){
			try{
				user.unban(message.author.id, flags.get('r') || flags.get('reason') || 'No reason specified..');
				message.channel.send('User ' + JSON.stringify(user.discrim) + ' unbanned.');
			}catch(err){
				if(err instanceof classes.error)message.channel.send(':no_entry: | ' + err.message);
				else throw err;
			}
		},
	},
	{
		alias: [ '_mute', '_m' ],
		infor: 'Mutes specified user',
		perm: 'helper',
		value_user: true,
		value(message, user, flags){
			var time = User.unit_time(flags.get('t') || flags.get('time')),
				reason = flags.get('r') || flags.get('reason') || 'No reason specified..';
			
			if(!time)return message.channel.send('Invalid time.');
			
			try{
				user.mute(message.author.id, reason, time);
				message.channel.send('User ' + JSON.stringify(user.discrim) + ' muted.');
			}catch(err){
				if(err instanceof classes.error)message.channel.send(':no_entry: | ' + err.message);
				else throw err;
			}
		},
	},
	{
		alias: [ '+mute', '+m', '_um' ],
		infor: 'Unmutes specified user',
		perm: 'helper',
		value_user: true,
		value(message, user, flags){
			try{
				user.unmute(message.author.id, flags.get('r') || flags.get('reason') || 'No reason specified..');
				message.channel.send('User ' + JSON.stringify(user.discrim) + ' unmuted.');
			}catch(err){
				if(err instanceof classes.error)message.channel.send(':no_entry: | ' + err.message);
				else throw err;
			}
		},
	},
	{
		alias: [ '_ipban', '_ib' ],
		infor: 'IP bans specified user',
		perm: 'mod',
		value_user: true,
		value(message, user, flags){
			var reason = flags.get('r') || flags.get('reason');
			
			if(!reason)return message.channel.send(':no_entry: | Specify a reason.');
			
			try{
				user.ipban(message.author.id, reason);
				message.channel.send('User ' + JSON.stringify(user.discrim) + ' ip-banned.');
			}catch(err){
				if(err instanceof classes.error)message.channel.send(':no_entry: | ' + err.message);
				else throw err;
			}
		},
	},
	{
		alias: [ '+ipban', '_uib', '+ib' ],
		infor: 'Un-ipbans specified user',
		perm: 'mod',
		value_user: true,
		value(message, user, flags){
			try{
				user.unipban(message.author.id, flags.get('r') || flags.get('reason') || 'No reason specified..');
				message.channel.send('User ' + JSON.stringify(user.discrim) + ' un-ipbanned.');
			}catch(err){
				if(err instanceof classes.error)message.channel.send(':no_entry: | ' + err.message);
				else throw err;
			}
		},
	},
	{
		alias: [ '_reload' ],
		infor: 'Reloads connected clients',
		perm: 'owner',
		value(message, value, flags){
			classes.io.bc('action', 'reload');
			message.channel.send('Ok.');
		},
	},
	{
		alias: [ '_lock', '_l' ],
		infor: 'Locks chat',
		perm: 'mod',
		value(message, args, perms){
			classes.io.locked ^= 1;
			classes.io.clients.forEach(io => io.send('lock', classes.io.locked));
			message.channel.send(`OK, chatbox ${classes.io.locked ? 'locked' : 'unlocked'}.`);
			
			classes.io.clients.forEach(io => io.sync());
		},
	},
	{
		alias: [ '_online', '_o' ],
		infor: 'Lists online clients',
		perm: 'helper',
		value(message, value, perms){
			var seen = [],
				found = classes.io.clients.filter(io => io.user && !io.user.punish && !seen.includes(io.user.id) && (seen.push(io.user.id), true));
			
			message.channel.send({ embed: {
				color: '#0099FF',
				title: `Connected users (${found.length}):`,
				fields: found.map(io => ({
					name: io.user.tag,
					value: User.time(Date.now() - io.start),
					inline: true,
				})),
			} });
		},
	},
	{
		infor: 'Help command',
		alias: [ '_help', '_h' ],
		perm: 'helper',
		value(message, value, flags){
			message.channel.send('```\n' + exports.commands.map(command => {
				var perm = command.perm || 'everyone';
				
				return [ perm[0].toUpperCase() + perm.substr(1), command.alias.join(', '), command.infor ].join(' : ')
			}).join('\n') + '\n```');
		},
	},
	{
		infor: 'Test the chatbox filter',
		alias: [ '_filter', '_f' ],
		perms: 'helper',
		value(message, value, flags){
			var filt = new filter(value),
				matches = Object.entries(filt.matches).filter(([ key, val ]) => val).map(([ key, val ]) => '**' + key + '**\n' + (Array.isArray(val) ? val.filter(x => x).join('\n') : (val ? 'Yes' : 'No')));
			
			if(!matches || matches == '')matches = 'None';
			
			message.channel.send({ embed: {
				title: filt.string || '[EMPTY]',
				fields: [{
					name: 'String',
					value: filt.toString() || '[EMPTY]',
					inline: true,
				},{
					name: 'Matches',
					value: matches,
				},{
					name: 'Variants',
					value: Object.entries(filt.variants).map(([ key, val ]) => '**' + key + '**: ' + val).join('\n'),
				},],
			} });
		},
	},
];