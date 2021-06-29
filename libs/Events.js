'use strict';

var original_func = Symbol(),
	listeners = Symbol(),
	resolve_list = (target, event) => {
		var events = (target[listeners] || (target[listeners] = {}))[event] || (target[listeners][event] = []);
		
		if(!events.merged){
			events.merged = true;
			
			if(target.constructor.hasOwnProperty(listeners))events.push(...resolve_list(target.constructor, event));
		}
		
		return events;
	};

class Events {
	on(event, callback){
		resolve_list(this, event).push(callback);
	}
	once(event, callback){
		var cb = (...data) => {
			this.off(event, cb);
			callback.call(this, ...data)
		};
		
		cb[original_func] = callback;
		
		this.on(event, callback);
	}
	off(event, callback){
		if(typeof callback != 'function')throw new Error('callback is not a function');
		
		if(callback[original_func])callback = callback[original_func];
		
		var list = resolve_list(this, event), ind = list.indexOf(callback);
		
		if(ind != -1)list.splice(ind, 1);
		
		if(!list.length)delete this[listeners][event];
	}
	emit(event, ...data){
		var list = resolve_list(this, event);
		
		if(!list.length){
			delete this[listeners][event];
			if(event == 'error')throw data[0];
		}else for(var item of list)try{
			item.call(this, ...data);
		}catch(err){
			this.emit('error', err);
		}
	}
};

var resolve_args = args => {
	var callback = args.findIndex(arg => typeof arg == 'function');
	
	return {
		label: args.find(arg => typeof arg == 'string'),
		callback: args[callback],
		expects: callback == 0 ? [] : args[0],
	};
};

var wrap_type = (event, args, type = 'on') => {
	var rargs = resolve_args(args);
	
	if(!rargs.callback)throw new Error('Callback not specified');
	
	return Object.assign(async function(...data){
		var return_id = type == 'get' && data.splice(0, 1)[0];
		
		if(rargs.expects.every((type, ind) => type == 'unknown' || (Array.isArray(data[ind]) ? 'array' : typeof data[ind]) == type)){
			// resolve, reject
			if(return_id){
				try{
					var data = await rargs.callback.call(this, ...data);
					this.send(return_id, 0, data);
				}catch(err){
					if(err instanceof Error){
						console.error('node error:', err);
						
						err = {};
					}
					
					this.send(return_id, 1, err);
				}
			}else{
				rargs.callback.call(this, ...data);
			}
		}else console.error(`Skip ${event}
Expect: ${rargs.expects.join(', ')}
Got   : ${rargs.expects.map((type, ind) => Array.isArray(data[ind]) ? 'array' : typeof data[ind]).join(', ')}
Data  : ${data.join(', ')}`);
	}, {
		[original_func]: rargs.callback,
	});
};

class EventsType extends Events {
	on(event, ...args){
		super.on(event, wrap_type(event, args));
	}
	once(event, ...args){
		super.once(event, wrap_type(event, args));
	}
	get(event, ...args){
		super.on(event, wrap_type(event, args, 'get'));
	}
};

Events.Type = EventsType;
Events.listeners = listeners;
module.exports = Events;