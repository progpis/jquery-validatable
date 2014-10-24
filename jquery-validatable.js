(function($, window) {

	var VERSION = '0.3.7';

	$.fn.validatable = function(opts, els){
		options = $.extend(true, {}, defaults, opts || {});
		elements = els || {};
		return this.each(function(){ new Form($(this)); });
	};

	// default options, applied to forms, groups and fields
	var defaults = {

		// class names applied to group-validatable on success and fail
		className: {
			valid      : 'has-success',
			invalid    : 'has-error'
		},

		// trigger group validation on field events
		validateOn: {
			change     : true,
			blur       : true,
			submit     : true
		},

		required       : true, // field is required

		// group/field validation rules
		rules: {
			value      : null, // field value must match
			regex      : null, // field value must match regular expression
			min        : null, // field: value must be equal or greater, group: number of valid fields must be equal or greater
			max        : null  // field: value must be equal or lower, group: number of valid fields must be equal or lower
		},

		// custom validator
		validate       : null,

		// event types
		on: {
			ready      : null, // triggered when form/group/field has finished initiation
			submit     : null, // triggered on form submit
			change     : null, // triggered on field change
			valid      : null, // triggered when group/field has been successfully validated
			invalid    : null, // triggered when group/field has been unsuccessfully validated
			neutral    : null // triggered when group/field has been neutrally validated
		}

	};

	// form/group/field options merged with defaults
	var options;

	// element options indexed by element id
	var elements;

	//
	// helper library
	//

	var helper = {
		scrollToFirstInvalidGroup: function(animTime, offsetY){
			var time, top, $group;
			time = time || 200;
			top = offsetY || 30;
			$group = helper.form.$e.find('div.'+helper.form.options.className.invalid+'.group-validatable:first');
			$group.length && $('html, body').animate({ scrollTop: ($group.offset().top - top)}, time);
			return helper;
		},
		focusFirstInvalidField: function(){
			var $group, $field;
			$group = helper.form.$e.find('div.'+helper.form.options.className.invalid+'.group-validatable:first');
			$field = $group.find('.field-validatable:first');
			$field.length && $field.focus();
			return helper;
		}
	};

	//
	// validator library
	//

	var validator = {

		validate: function(validator){
			var valid, rule, val;

			if (!this.options.required && validator.empty.call(this)) {
				return null;
			}

			// use custom validator if available
			if ('function' === typeof this.options.validate) {
				return this.options.validate.call(this);
			}

			valid = validator.valid.call(this);
			if (false === valid) {
				return false;
			}

			// validates form/group/field value against available rules
			if ('object' !== typeof this.options.rules) return null;
			for(rule in this.options.rules) {
				if (!this.options.rules.hasOwnProperty(rule)) continue;
				val = this.options.rules[rule];
				if (null === val) continue;
				validator[rule] && 'function' === typeof validator[rule] && (valid = validator[rule].call(this, val));
				if (false === valid) return false;
			}
			return valid;
		},

		field: {

			valid: function(){
				return !this.empty();
			},
			empty: function(){
				return this.empty();
			},
			equals: function(val){
				return this.val() == val;
			},
			regex: function(val){
				return val.test(this.val());
			},
			min: function(val){
				return this.val() >= val;
			},
			max: function(val){
				return this.val() <= val;
			}

		},
		group: {

			empty: function(){
				return false;
			},

			valid: function(){
				var required, count, id, valid;
				required = this.options.required;
				count = {t: 0, f: 0, u: 0};
				for(id in this.fields) {
					if (!this.fields.hasOwnProperty(id)) continue;
					valid = this.fields[id].validate();
					switch(true){
						case false === valid : count['f']++; break;
						case  true === valid : count['t']++; break;
						default              : count['u']++; break;
					}
				}
				return count['f'] > 0 ? (true === required ? false : null) : (count['t'] > 0 ? true : null);
			},

			// valid if at least one field has required value, invalid otherwise
			equals: function(val){
				var id;
				for(id in this.fields) {
					if (!this.fields.hasOwnProperty(id)) continue;
					if (this.fields[id].val() == val) return true;
				}
				return false;
			},

			// valid if number of valid fields is at least 'val'
			min: function(val){
				return this.count() >= val;
			},

			// valid if number of valid fields is at most 'val'
			max: function(val){
				return this.count() <= val;
			}

		},
		form: {

			empty: function(){
				return false;
			},

			valid: function(){
				var id, valid, groupValid;
				valid = null;
				for(id in this.groups) {
					if (!this.groups.hasOwnProperty(id)) continue;
					groupValid = this.groups[id].validate();
					switch(true){
						case true  === groupValid : valid = valid === false ? false : true; break;
						case false === groupValid : valid = false;                          break;
					}
				}
				return valid;
			}

		}
	};

	//
	// validatable library
	//

	var validatable = {

		// object constructor
		init: function($e, vars){
			var i;
			if (vars && 'object' === typeof vars) {
				for(i in vars) {
					if (!vars.hasOwnProperty(i)) continue;
					this[i] = vars[i];
				}
			}
			this.id = $e.attr('id');
			this.$e = $e;
			this.options = $.extend(true, {}, options, elements[this.id] || {});
		},

		// creates children identified by 'locator' query using 'constructor' function
		children: function(locator, constructor){
			var children, child;
			children = {};
			this.$e.find(locator).each(function(){
				child = constructor($(this));
				children[child.id] = child;
			});
			return children;
		},

		// returns element type
		type: function(){
			var tag, attr, type;
			tag  = this.$e.prop('tagName').toLowerCase();
			attr = this.$e.attr('type');
			switch(true) {
				case 'select'   == tag                       : type = 'select';     break;
				case 'textarea' == tag                       : type = 'textarea';   break;
				case 'input'    == tag && 'text'     == attr : type = 'text';       break;
				case 'input'    == tag && 'checkbox' == attr : type = 'checkbox';   break;
				case 'input'    == tag && 'radio'    == attr : type = 'radio';      break;
				case 'input'    == tag && 'hidden'   == attr : type = 'hidden';     break;
				default                                      : type = 'unknown';    break;
			}
			return type;
		}

	};

	//
	// Validatable class
	//

	var Validatable = function(){};

	// triggers event 'type'
	Validatable.prototype.event = function(type, event){
		var c;

		// tries to call user-defined function 'on[type]'
		c = null;
		'object' === typeof this.options.on && this.options.on[type] && 'function' === typeof this.options.on[type]
		&& (c = this.options.on[type].call(this, event, this));

		// if user-defined function exists and didn't return strict false, tries to call class-defined function 'on[type]'
		false !== c
			&& this.on && 'object' === typeof this.on && this.on[type] && 'function' === typeof this.on[type]
		&& this.on[type](event);

	};

	// validates form/group/field using object's validator
	Validatable.prototype.validate = function(){
		var valid;
		valid = validator.validate.call(this, this.validator);
		switch(true){
			case  true === valid : this.event('valid');   return true;
			case false === valid : this.event('invalid'); return false;
			default              : this.event('neutral'); return null;
		}
	};

	//
	// Field class - represents form input/select/textarea
	//

	var Field = function($e, group){
		var self = this;
		validatable.init.call(this, $e, {group: group});
		this.type = validatable.type.call(this);
		this.validator = validator.field;
		this.on = {
			change   : function(event){
				self.group.on.fieldChange(event, self);
			},
			blur     : function(event){
				self.group.on.fieldBlur(event, self);
			},
			keypress : function(event){
				self.options.filter
					&& -1 === [0, 8].indexOf(event.which)
					&& !self.options.filter.test(String.fromCharCode(event.which))
				&& event.preventDefault();
			}
		};
		this.$e.bind('change',   function(event){self.event('change',   event)});
		this.$e.bind('blur',     function(event){self.event('blur',     event)});
		this.$e.bind('keypress', function(event){self.event('keypress', event)});
		this.event('ready');
	};

	// returns field value
	Field.prototype.val = function(){
		switch(this.type) {
			case 'checkbox' : return this.$e.is(':checked') ? this.$e.val() : '';
			case 'radio'    : return this.$e.is(':checked') ? this.$e.val() : '';
			default         : return this.$e.val();
		}
	};

	// returns true if field is strictly not empty
	Field.prototype.empty = function(){
		return this.val() == '';
	};

	// sets field value
	Field.prototype.set = function(val){
		switch(this.type) {

			case 'text' :
			case 'textarea' :
				this.$e.val(val);
				break;

			case 'select' :
				if (this.$e.find('option[value="'+val+'"]').length > 0) {
					this.$e.val(val);
				}
				break;

			case 'checkbox' :
				switch(true) {
					case true  === val : this.$e.prop('checked', true);  break;
					case false === val : this.$e.prop('checked', false); break;
					default            : this.$e.val(val);               break;
				}
				break;

			case 'radio' :
				// TODO implement me
				break;
		}
	};

	Field.prototype = $.extend({}, Validatable.prototype, Field.prototype);

	//
	// Group class - represents form-group
	//

	var Group = function($e, form){
		var self = this;
		validatable.init.call(this, $e, {form: form});
		this.options.required = true;
		this.fields = validatable.children.call(this, '.field-validatable', function($e){return new Field($e, self)});
		this.validator = validator.group;
		this.on = {
			fieldChange : function(event, field){ self.options.validateOn.change && self.validate() },
			fieldBlur   : function(event, field){ self.options.validateOn.blur   && self.validate() },
			valid       : function(event){self.valid()},
			invalid     : function(event){self.invalid()},
			neutral     : function(event){self.reset()}
		};
		this.event('ready');
	};

	// removes group validation states
	Group.prototype.reset = function(){
		this.$e.removeClass(this.options.className.valid).removeClass(this.options.className.invalid);
	};

	// sets group validation state to 'valid'
	Group.prototype.valid = function(){
		this.reset();
		this.$e.addClass(this.options.className.valid);
	};

	// sets group validation state to 'invalid'
	Group.prototype.invalid = function(){
		this.reset();
		this.$e.addClass(this.options.className.invalid);
	};

	Group.prototype.val = function(){
		var id;
		for(id in this.fields) {
			if (!this.fields.hasOwnProperty(id)) continue;
			if (this.fields[id].validate() !== false) {
				return this.fields[id].val();
			}
		}
		return null;
	};

	// return number of valid child fields
	Group.prototype.count = function(){
		var count, id;
		count = 0;
		for(id in this.fields) {
			if (!this.fields.hasOwnProperty(id)) continue;
			if (this.fields[id].validate() !== false) count++;
		}
		return count;
	};

	Group.prototype = $.extend({}, Validatable.prototype, Group.prototype);

	//
	// Form class
	//

	var Form = function($e){
		var self = this;
		validatable.init.call(this, $e);
		this.options.required = true;
		this.groups = validatable.children.call(this, '.group-validatable', function($e){return new Group($e, self)});
		this.validator = validator.form;
		this.helper = helper;
		this.helper.form = this;
		this.on = {

			submit: function(event){
				var valid;
				self.options.validateOn.submit && (valid = self.validate());
				if (false === valid) {
					event.preventDefault();
				}
			},

			invalid: function(event){
				helper.scrollToFirstInvalidGroup().focusFirstInvalidField();
			}

		};
		this.$e.bind('submit', function(event){self.event('submit', event)});
		this.event('ready');
	};

	Form.prototype = $.extend({}, Validatable.prototype, Form.prototype);

})(jQuery, window);