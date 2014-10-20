(function($, window) {

	var VERSION = '0.3.2';

	var defaultOptions = {
		debug: false,
		required: true,
		bind: {
			change  : true,
			blur    : true,
			keydown : false,
			submit  : true
		},
		className: {
			valid: 'has-success',
			invalid: 'has-error'
		},
		observe: undefined,
		validate: undefined,
		rules: {
			val: undefined,
			regex: undefined,
			min: undefined,
			max: undefined
		},
		datepicker: {
			dateFormat: undefined,
			altFormat: undefined
		}
	};
	var Options;
	var Elements;

	$.fn.validatable = function(options, elements){
		Options = $.extend(true, {}, defaultOptions, options || {});
		Elements   = elements || {};
		return this.each(function(){
			new Form($(this));
		});
	};

	// Observable ------------------------------------------------------------------------------------------------------

	var Observable = function(){};

	Observable.prototype.register = function(observer){
		if (!this.observers) this.observers = [];
		this.options.debug && console.debug(this.id, 'Observable.register', observer);
		this.observers.push(observer);
	};

	Observable.prototype.trigger = function(type, event){
		this.options.debug && console.debug(this.id, 'Observable.trigger', type, event);
		if (!this.observers) return true;
		for(var i in this.observers) {
			if (!this.observers.hasOwnProperty(i)) continue;
			var cont = this.observers[i](type, this, event);
			this.options.debug && console.debug(this.id, 'Observable.trigger', 'observer', this.observers[i], cont);
			if (cont === false) {
				return false;
			}
		}
		return true;
	};

	// Validator -------------------------------------------------------------------------------------------------------

	var Validator = {

		validate: function(){
			this.options.debug && console.debug(this.id, 'Validator.validate');
			return undefined;
		},

		rules: function(){
			this.options.debug && console.debug(this.id, 'Validator.rules');
			if (!this.options || !this.options.rules || !this.val) return undefined;
			var value = this.val();
			for(var key in this.options.rules) {
				if (!this.options.rules.hasOwnProperty(key)) continue;
				var val = this.options.rules[key];
				var isValid = undefined;
				this.validator[key] && (isValid = this.validator[key].call(this, val));
				this.options.debug && console.debug(this.id, 'Validator.rules', key, val, isValid);
				if (false === isValid) return false;
			}
			return true;
		}

	};

	// FieldValidator --------------------------------------------------------------------------------------------------

	var FieldValidator = $.extend(true, {}, Validator, {

		validate: function(){
			this.options.debug && console.debug(this.id, 'FieldValidator.validate', this.options.required);
			return this.isEmpty() ? (this.options.required ? false : undefined) : true;
		},

		val: function(val){
			this.options.debug && console.debug(this.id, 'FieldValidator.val', this.val(), val);
			return this.val() == val;
		},

		regex: function(regex){
			this.options.debug && console.debug(this.id, 'FieldValidator.regex', this.val(), regex);
			return regex.test(this.val());
		}

	});

	// GroupValidator --------------------------------------------------------------------------------------------------

	var GroupValidator = $.extend(true, {}, Validator, {

		validate: function(){
			this.options.debug && console.debug(this.id, 'GroupValidator.validate');
			var count = {t: 0, f: 0, u: 0};
			for(var id in this.children) {
				if (!this.children.hasOwnProperty(id)) continue;
				var fieldValid = this.children[id].validate();
				this.options.debug && console.debug(this.id, 'GroupValidator.validate', id, fieldValid);
				switch(true){
					case false === fieldValid : count['f']++; break;
					case  true === fieldValid : count['t']++; break;
					default                   : count['u']++; break;
				}
			}
			this.options.debug && console.debug(this.id, 'GroupValidator.validate', count);
			return count['f'] > 0 ? false : (count['t'] > 0 ? true : undefined);
		},

		val: function(val){
			this.options.debug && console.debug(this.id, 'GroupValidator.val', val);
			for(var id in this.children) {
				if (!this.children.hasOwnProperty(id)) continue;
				if (this.children[id].val() == val) return true;
			}
			return false;
		},

		min: function(min){
			this.options.debug && console.debug(this.id, 'GroupValidator.min', min);
			return this.countValid() >= min;
		},

		max: function(max){
			this.options.debug && console.debug(this.id, 'GroupValidator.max', max);
			return this.countValid() <= max;
		}

	});

	// FormValidator ---------------------------------------------------------------------------------------------------

	var FormValidator = $.extend(true, {}, Validator, {

		validate: function(){
			this.options.debug && console.debug(this.id, 'FormValidator.validate');
			var isValid = true;
			for(var id in this.children) {
				if (!this.children.hasOwnProperty(id)) continue;
				var groupValid = this.children[id].validate();
				this.options.debug && console.debug(this.id, 'FormValidator.validate', id, groupValid);
				if (groupValid === false) {
					isValid = false;
				}
			}
			return isValid;
		}

	});

	// Validatable -----------------------------------------------------------------------------------------------------

	var Validatable = function(){};

	Validatable.prototype._construct = function($element, parent) {
		this.id = $element.attr('id');
		this.$element = $element;
		this.parent = parent;
		this.options = $.extend(true, {}, Options, Elements[this.id] || {});
		if (this.options.observe) {
			this.register(this.options.observe);
		}
	};

	Validatable.prototype._children = function(selector, creator, onEvent) {
		this.children = {};
		var self = this;
		this.$element.find(selector).each(function() {
			var child = creator($(this));
			if (onEvent) {
				child.register(onEvent);
			}
			self.children[child.id] = child;
		});
	};

	Validatable.prototype.validate = function(){
		this.options.debug && console.debug(this.id, 'Validatable.validate', undefined !== this.options.validate, undefined !== this.options.rules);
		var isValid = undefined;
		switch(true) {
			case undefined !== this.options.validate : isValid = this.options.validate(this);        break;
			case undefined !== this.options.rules    : isValid = this.validator.rules.call(this);    break;
			default                                  : isValid = this.validator.validate.call(this); break;
		}
		return isValid;
	};

	// Preview ---------------------------------------------------------------------------------------------------------

	var Preview = function($element, field){
		var self = this;
		this._construct($element, field);

		this.$element.hasClass('validatable-datepicker') && this.$element.datepicker($.extend(true, {
			altField: '#'+self.parent.id
		}, this.options.datepicker));

		this.options.bind.change && self.$element.bind('change', function(){
			self.trigger('preview.change');
		});

		this.options.bind.blur && self.$element.bind('blur', function(){
			self.trigger('preview.blur');
		});
	}

	Preview.prototype = $.extend({}, Observable.prototype, Validatable.prototype, Preview.prototype);

	// Field -----------------------------------------------------------------------------------------------------------

	var Field = function($field, group){
		var self = this;
		this._construct($field, group);
		this.validator = FieldValidator;

		this.type = (function(){
			var type = undefined;
			var tag  = self.$element.prop('tagName').toLowerCase();
			var attr = self.$element.attr('type');
			switch(true) {
				case 'select'   == tag                       : type = 'select';     break;
				case 'textarea' == tag                       : type = 'textarea';   break;
				case 'input'    == tag && 'text'     == attr : type = 'text';       break;
				case 'input'    == tag && 'checkbox' == attr : type = 'checkbox';   break;
				case 'input'    == tag && 'radio'    == attr : type = 'radio';      break;
				case 'input'    == tag && 'hidden'   == attr : type = 'hidden';     break;
				default                                      : throw 'Invalid field#'+self.id+' type: '+tag+'['+attr+']';
			}
			return type;
		})();

		self.$element.data('preview') && (function(){
			var previewId = self.$element.data('preview');
			self.children = {};
			var child = new Preview($('#'+previewId), self);
			child.register(function(type, event){
				switch(type) {
					case 'preview.change' : self.trigger('field.change', event); break;
					case 'preview.blur'   : self.trigger('field.blur', event);   break;
				}
				return false;
			});
			self.children[child.id] = child;
		})();

		this.options.bind.change && this.$element.bind('change', function(event){
			self.trigger('field.change', event);
		});

		this.options.bind.blur && this.$element.bind('blur', function(event){
			self.trigger('field.blur', event);
		});

		this.options.bind.keydown && this.$element.bind('keydown', function(event){
			self.trigger('field.key', event);
		});

		this.trigger('field.ready');
	};

	Field.prototype.val = function(){
		switch(this.type) {
			case 'checkbox' : return this.$element.is(':checked') ? this.$element.val() : '';
			case 'radio'    : return this.$element.is(':checked') ? this.$element.val() : '';
			default         : return this.$element.val();
		}
	};

	Field.prototype.set = function(val){
		switch(this.type) {
			case 'text' :
			case 'textarea' :
				this.$element.val(val);
				break;

			case 'select' :
				if (this.$element.find('option[value="'+val+'"]').length > 0) {
					this.$element.val(val);
				}
				break;

			// TODO implement for radio, checkbox
		}
	};

	Field.prototype.isEmpty = function(){
		return this.val() == '';
	};

	Field.prototype.validate = function() {
		this.options.debug && console.debug(this.id, 'Field.validate');
		var status = Validatable.prototype.validate.call(this);
		switch(true){
			case  true === status : this.trigger('field.valid');   return true;
			case false === status : this.trigger('field.invalid'); return false;
			default               : this.trigger('field.neutral'); return undefined;
		}
	};

	Field.prototype = $.extend({}, Observable.prototype, Validatable.prototype, Field.prototype);

	// Group -----------------------------------------------------------------------------------------------------------

	var Group = function($group, form){
		var self = this;
		this._construct($group, form);
		this._children('input.validatable, select.validatable, textarea.validatable', function($field){
			return new Field($field, self);
		}, function(type, field, event){
			switch(type){
				case 'field.change' :
				case 'field.blur' :
					self.validate();
					break;
			}
		});
		this.validator = GroupValidator;
		this.trigger('group.ready');
	};

	Group.prototype.reset = function(){
		this.options.debug && console.debug(this.id, 'Group.reset');
		this.$element.removeClass(this.options.className.valid).removeClass(this.options.className.invalid);
	};

	Group.prototype.invalid = function(){
		this.options.debug && console.debug(this.id, 'Group.invalid');
		this.reset();
		this.$element.addClass(this.options.className.invalid);
	};

	Group.prototype.valid = function(){
		this.options.debug && console.debug(this.id, 'Group.valid');
		this.reset();
		this.$element.addClass(this.options.className.valid);
	};

	Group.prototype.val = function(){
		this.options.debug && console.debug(this.id, 'Group.val');
		for(var id in this.children) {
			if (!this.children.hasOwnProperty(id)) continue;
			if (this.children[id].validate() !== false) {
				var val = this.children[id].val();
				this.options.debug && console.debug(this.id, 'Group.val', id, 'valid', val);
				return val;
			} else {
				this.options.debug && console.debug(this.id, 'Group.val', id, 'invalid');
			}
		}
		return undefined;
	};

	Group.prototype.countValid = function(){
		var count = 0;
		for(var id in this.children) {
			if (!this.children.hasOwnProperty(id)) continue;
			if (this.children[id].validate() !== false) count++;
		}
		this.options.debug && console.debug(this.id, 'Group.countValid', count);
		return count;
	};

	Group.prototype.validate = function() {
		this.options.debug && console.debug(this.id, 'Group.validate');
		var status = Validatable.prototype.validate.call(this);
		switch(true){
			case  true === status : false === this.trigger('group.valid')   || this.valid();   return true;
			case false === status : false === this.trigger('group.invalid') || this.invalid(); return false;
			default               : false === this.trigger('group.neutral') || this.reset();   return undefined;
		}
	};

	Group.prototype = $.extend({}, Observable.prototype, Validatable.prototype, Group.prototype);

	// Form ------------------------------------------------------------------------------------------------------------

	var Form = function($form){
		var self = this;
		this._construct($form);
		this._children('div.form-group.validatable', function($group){
			return new Group($group, self);
		}, function(type, group, event){
			//
			//
			//
		});
		this.validator = FormValidator;

		this.options.bind && this.options.bind.submit && this.$element.bind('submit', function(event){
			self.options.debug && console.debug(self.id, 'Form.submit');
			if (false === self.trigger('form.submit', event)) return false;
			try {
				var isValid = self.validate();
				self.options.debug && console.debug(self.id, 'Form.submit', 'isValid', isValid);
			} catch(error){
				console.error(error);
			}
			if (isValid){
				if (false === self.trigger('form.valid', event)) return false;
			} else {
				if (false === self.trigger('form.invalid', event)) return false;
				event.preventDefault();
			}
			return true;
		});

		this.trigger('form.ready');
	};

	Form.prototype = $.extend({}, Observable.prototype, Validatable.prototype, Form.prototype);

})(jQuery, window);