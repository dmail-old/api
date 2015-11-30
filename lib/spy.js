import proto from 'proto';

var Call = proto.extend({
	[proto.type]: 'Call',

	constructor(properties){
		Object.assign(this, properties);
	}
});

var Spy = proto.extend({
	[proto.type]: 'Spy',

	constructor(method){
		this.calls = [];
		this.method = method;
	},

	apply(thisValue, argValues){
		var returnValue, errored = false, error;

		if( this.method ){
			try{
				returnValue = this.method.apply(thisValue, argValues);
			}
			catch(e){
				errored = true;
				error = e;
			}
		}

		var callProperties = {
			thisValue: thisValue,
			argValues: argValues,
			returnValue: returnValue,
			stack: new Error().stack
		};

		if( errored ){
			callProperties.error = error;
		}

		var call = Call.create(callProperties);

		this.calls.push(call);

		return returnValue;
	},

	call(thisValue){
		return this.apply(thisValue, Array.prototype.slice.call(arguments, 1));
	},

	toFunction(){
		var self = this;
		var fn = function(){
			return self.apply(this, arguments);
		};

		// prototype properties
		Object.getOwnPropertyNames(this.constructor).forEach(function(name){
			Object.defineProperty(fn, name, Object.getOwnPropertyDescriptor(this.constructor, name));
		}, this);
		// instance properties
		Object.getOwnPropertyNames(this).forEach(function(name){
			Object.defineProperty(fn, name, Object.getOwnPropertyDescriptor(this, name));
		}, this);

		return fn;
	}
});