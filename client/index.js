'use strict';

var { socket, nodes } = require('./libs/constants'),
	assets = require('../data/assets');

socket.on('open', () => {
	(localStorage.getItem('token') ? socket.get('token', JSON.parse(localStorage.getItem('token'))) : Promise.reject()).catch(() => new Promise(resolve => {
		var form =  new Discord.Form('Signup or login to Chatutils', 'Enter an email and password.', 'This is NOT your Discord login', false),
			email = new Discord.Form.Input(form, 'Email', 'email', 'doga1tap@gmail.com'),
			pass = new Discord.Form.Input(form, 'Password', 'password', 'test1234'),
			signup = new Discord.Form.Button(form, 'Signup', true),
			login = new Discord.Form.Button(form, 'Login', true);
		
		form.on('submit', detail => {
			detail.prevent_default();
			
			socket.get(detail.node == signup.main ? 'signup' : 'login', email.value, pass.value).then(token => {
				form.close();
				
				localStorage.setItem('token', JSON.stringify(token));
				
				resolve();
			}).catch(err => form.error(err));
		});
	})).finally(() => {
		
	});
});

socket.once('open', () => {
	// reconnected
	socket.on('open', () => socket.emit('reconnected'));
});

socket.on('close', () => socket.connect(socket.url));

socket.connect('ws' + (location.protocol == 'http:' ? '' : 's') + '://' + location.host);

var DOM = require('./libs/DOM'),
	gen_uuid = () => [...Array(4)].map(() => {
		var d0 = Math.random() * 0xffffffff | 0;
		return ('' + (d0 & 0xff).toString(16)).padStart(2, 0) + ('' + (d0 >> 8 & 0xff).toString(16)).padStart(2, 0) + ('' + (d0 >> 16 & 0xff).toString(16)).padStart(2, 0) + ('' + (d0 >> 24 & 0xff).toString(16)).padStart(2, 0)
	}).join('-').toUpperCase(),
	Discord = require('./libs/Discord'),
	client = new Discord.Client();

socket.on('message', data => client.handle_message(data));

socket.on('message_delete', (channel, id) => {
	var channel = client.channels.get(channel),
		content = channel ? channel.contents.get(id) : null;
	
	if(content)content.delete(false, true);
});

socket.on('message_update', data => {
	var channel = client.channels.get(data.channel),
		content = channel ? channel.contents.get(data.id) : null;
	
	if(content)content.construct(channel.can_scroll(), data);
});

socket.on('message_react', (channel, id, reactions) => {
	var channel = client.channels.get(channel),
		content = channel ? channel.contents.get(id) : null;
	
	if(content)content.reactions(reactions);
});

socket.on('reconnected', () => client.channels.forEach(channel => {
	if(channel.active)channel.fetch_messages();
}));

// runs after meta stuff is set and goes to guild (on first load)
var initial_guild;

socket.on('meta', guilds => {
	client.guilds.forEach(guild => guild.delete());
	
	guilds.forEach((data, ind) => {
		var guild = new Discord.Guild(client, data),
			menu = DOM.add_ele('div', guild.sidebar.channels, { className: 'channel-menu' });
		
		DOM.add_ele('raw', menu, {
			html: assets.svg.channel.invite,
			className: 'icon',
		});
		
		DOM.add_ele('div', menu, { className: 'label', innerHTML: 'Join the Discord' });
		
		menu.addEventListener('click', () => socket.get('invite', guild.id).then(code => {
			if(document.querySelector('[data-title*="Invite"]'))return;
			
			var form = new Discord.Form('Invite generated'),
				code_input = new Discord.Form.Input(form, 'Code', '', 'discord.gg/' + code),
				close = new Discord.Form.Button(form, 'Close'),
				open = new Discord.Form.Button(form, 'Open', true);
			
			open.addEventListener('click', () => (form.close(), window.open('https://discord.com/invite/' + code)));
		}));
	});
	
	if(client.channels.has(client.last_channel))client.channels.get(client.last_channel).show();
	else client.guilds.forEach(guild => guild.id == '735331808450969600' && guild.show());
});

socket.on('user', (data, locked) => {
	client.user = data;
	client.locked = locked;
	
	client.update();
});
socket.on('action', (type, val, nonce) => {
	switch(type){
		case'reload':
			socket.disconnect();
			window.location.reload();
			break
		case'redirect':
			window.location.href = val;
			break
		default:
			break;
	}
});

socket.on('typing', typing => Object.entries(typing).forEach(data => {
	var id = data[0],
		typers = data[1],
		channel = client.channels.get(id);
	
	if(!channel)return;
	
	channel.typers.innerHTML = assets.typing[ typers.length >= 4 ? 4 : typers.length ].replace(/{typers}/g, Object.values(typers).map(typer => '<span>' + typer.name + '</span>').join(' and '));
	
	channel.typing_box.style.opacity = typers.length ? 1 : 0;
}));

socket.on('info', data => new Discord.Popup({
	title: data.title,
	content: data.content,
	expires: 3000,
	closeable: true,
}));

document.body.addEventListener('keydown', event => {
	if(!document.activeElement || document.activeElement && document.activeElement.nodeName != 'INPUT' && !event.ctrlKey && !event.shiftKey){
		var found;
		
		for(var channel of client.channels)if(channel.active && channel.input)channel.input.bar.focus();
	}
});