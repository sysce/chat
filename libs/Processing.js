'use strict';

var Socket = require('./socket');

exports.message = async (message, push = true) => {
	var channel = await require('../data/constants').bot.channel(message.channel.id);
	
	// if(!cud.channels.has(channel.id))return;
	
	var // rchannel = cud.channels.get(channel.id),
		// reference = message.reference && rchannel.last50.get(message.reference.messageID),
		p_message = {
			type: message.type,
			mentions: [ [], [], [] ],
			embeds: [...message.embeds.values()],
			attachments: [...message.attachments.values()],
			edited: !!message.editedTimestamp,
			timestamp: message.createdTimestamp,
			tts: message.tts,
			channel: channel.id,
			author: {
				bot: message.author.bot,
				id: message.author.id,
				color: (message.member && message.member.displayColor) ? message.member.displayHexColor : '#FFF',
				avatar: message.author.avatarURL({ format: 'webp', dynamic: true, size: 32 }) || message.author.defaultAvatarURL,
				name: message.member ? message.member.displayName : message.author.username,
			},
			reactions: [...message.reactions.cache.values()].map(data => ({
				count: data.count,
				name: data._emoji.name,
				id: data._emoji.id,
			})),
			content: message.content,
			tts: message.tts,
			id: message.id,
			// ref: reference ? JSON.parse(JSON.stringify(reference)) : null,
		};
	
	message.mentions.users.forEach(mention => {
		var member = message.guild.members.cache.find((member, index) => mention.id == member.id && member.displayName);
		
		p_message.mentions[1].push([ mention.id, member ? (member.displayName || member.username) : mention.username ]);
	});
	
	message.mentions.roles.forEach(role => {
		var color = role.color ? role.color.toString(16) : 'FFFFFF';
		
		// #FFF => #FFFFFF
		if(color.length != 6)color = [...color].map(x => x + x).join('');
		
		p_message.mentions[0].push([ role.id, role.name, color ]);
	});
	
	message.mentions.channels.forEach(data => p_message.mentions[2].push([ data.id, data.name ]));
	
	if(push)channel.last50.set(message.id, p_message);
	
	// splice and keep last 50
	if(channel.last50.size > 50){
		var deleted = [...channel.last50.keys()].slice(0, -50).map(key => (channel.last50.delete(key), key));
		
		// sync clients
		for(var client of Socket.clients)if(client.can_access_channel(channel.id))client.send_many(deleted.map(id => [ 'message_delete', channel.id, id ]));
	}
	
	return p_message;
};