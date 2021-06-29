'use strict';

var DOM = require('../DOM'),
	Events = require('../../../libs/Events'),
	{ nodes } = require('../constants');

class Form extends Events {
	constructor(title, description, hint = '', closable = true){
		super();
		
		this.cover = DOM.add_ele('div', nodes.body, { className: 'page-cover' });
		
		this.cover.dataset.title = title;
		
		this.closable = closable;
		
		this.wrapper = DOM.add_ele('form', this.cover, { className: 'dialog' });
		
		this.inputs = {};
		
		this.upper = DOM.add_ele('div', this.wrapper, { className: 'upper' });
		this.lower = DOM.add_ele('div', this.wrapper, { className: 'lower' });
		
		this.title = DOM.add_ele('div', this.upper, { className: 'title', textContent: title });
		this.description = DOM.add_ele('div', this.upper, { className: 'description', textContent: description });
		
		if(hint)this.hint = DOM.add_ele('div', this.upper, { className: 'hint', textContent: hint });
		
		this.cover.addEventListener('click', event => this.closable && event.target == this.cover && this.close() + reject());
		
		this.wrapper.addEventListener('submit', event => this.emit('submit', {
			node: event.submitter,
			prevent_default(){
				this.default_prevented = true;
				event.preventDefault();
			},
		}));
	}
	addEventListener(name, callback){
		console.error('depricated addEventListener call', name, callback);
		this.wrapper.addEventListener(name, callback);
	}
	error(data){
		for(var label in this.inputs)this.inputs[label].wrapper.classList.remove('error');
		
		for(var label in data){
			label = label.toLowerCase();
			
			this.inputs[label].wrapper.classList.add('error');
			this.inputs[label].error.textContent = ' - ' + data[label];
		}
	}
	close(){
		this.cover.remove();
	}
};

class Button {
	constructor(form, label, submit = false){
		this.main = DOM.add_ele('button', form.lower, { className: 'button' + (submit ? '' : ' invis'), textContent: label, type: submit ? 'submit' : 'button' });
		
		if(['cancel', 'close'].includes(label.toLowerCase()))this.addEventListener('click', () => form.closable && form.close());
	}
	addEventListener(name, callback){
		this.main.addEventListener(name, callback);
	}
};

class Input {
	constructor(form, label, type, value = ''){
		form.inputs[label.toLowerCase()] = this;
		
		this.wrapper = DOM.add_ele('div', form.upper, { className: 'input' });
		
		this.label = DOM.add_ele('div', this.wrapper, { textContent: label, className: 'label' });
		
		this.error = DOM.add_ele('div', this.label, { className: 'error' });
		
		this.input = DOM.add_ele('input', this.wrapper, { value: value, type: type, autocomplete: 'on', required: true });
	}
	get value(){
		return this.input.value;
	}
	set value(v){
		return this.input.value = v;
	}
};

Form.Button = Button;
Form.Input = Input;
module.exports = Form;