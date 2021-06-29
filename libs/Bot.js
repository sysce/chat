'use strict';

var Events = require('./events'),
	discord = require('discord.js'),
	constants = require('../data/constants.js');

class Bot extends Events {
	constructor(){
		super();
		
		this.client = new discord.Client();
		
		var event_bind = {
			ready: true,
			message: true,
			messageReactionAdd: 'reaction',
			messageReactionRemove: 'reaction_remove',
			messageReactionRemoveAll: 'reaction_remove_all',
			messageUpdate: 'message_update',
			messageDelete: 'message_delete',
			messageDeleteBulk: 'message_delete_bulk',
			typingStart: 'typing_start',
		};
		
		for(var event in event_bind)this.client.on(event, this.emit.bind(this, event_bind[event] == true ? event : event_bind[event]));
		
		this.base_perms = {
			mod: false,
			helper: false,
			admin: false,
			owner: false,
		};
		
		this.client.on('guildMemberAdd', member => this.filter_member(member));
		this.client.on('guildMemberUpdate', (old, member) => this.filter_member(member));
	}
	get token(){
		return this.client.token;
	}
	login(token){
		this.client.login(token);
	}
	perms(member){
		var output = {
			member: true,
		};
		
		for(var perm in constants.perms)output[perm] = member ?
			constants.perms[perm].members && constants.perms[perm].members.includes(member.id) ||
			constants.perms[perm].roles && constants.perms[perm].roles.some(role => member.roles.cache.has(role))
		: false;
		
		return output;
	}
	filter_member(member){
		if(member.guild.id != '735331808450969600' || !constants.production)return;
		
		var filtered = new filter(member.displayName);
		
		if(filtered.match && ['rule 8', 'rule 6', 'slur', 'invite'].includes(filtered.match[0]))member.setNickname(filtered.toString(), 'Contains a violation of the filter');
	}
	get avatar(){
		return this.client.user.displayAvatarURL();
	}
	async channel(id, hooks = true){
		var channel = await this.client.channels.fetch(id.toString());
		
		if(!channel)throw new Error('Bad channel: ' + id);
		
		if(hooks && !channel.last50){
			channel.last50 = new Map();
			await channel.messages.fetch({ limit: 50 }).then(async messages => Promise.all([...messages.values()].reverse().map(message => require('./processing.js').message(message))));
		}
		
		return channel;
	}
	async create_guild_invite(id){
		var guild = await this.client.guilds.fetch(id);
		
		for(var channel of guild.channels.cache.array()){
			if(!(channel instanceof discord.TextChannel))continue;
			
			// for(var channel of guild.channels.cache.guild.channels.resolve(id.toString())
			var invite = await channel.createInvite({
				maxAge: 86400,
				maxUses: 10,
				unique: false,
			}).catch(err => false);
			
			if(!invite)continue;
			
			return invite.url;
		}
		
		throw new Error('Could not generate invite');
	}
	activity(activity){
		var words = activity.split(' '),
			type = words.splice(0, 1)[0].toUpperCase(),
			status = words.join(' ');
		
		
		this.client.user.setActivity({ type: type, name: status });
	}
}

module.exports = Bot;