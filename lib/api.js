import proto from 'proto';

import FunctionSignature from './call-signature.js';

var API = proto.extend('Api', {
	constructor(method){
		if( arguments.length === 0 ){
			throw new Error('API method missing');
		}
		if( typeof method != 'function' ){
			throw new TypeError('API method must be a function');
		}

		var argumentSignature;
		// if there is no argumentSignature, force only the length from method.length
		if( arguments.length === 1 ){
			argumentSignature = new Array(method.length);
		}
		else{
			argumentSignature = Array.prototype.slice.call(arguments, 1);
		}

		var signature = FunctionSignature.create(argumentSignature);
		var self = this;
		var fn = function(){
			// we can use proto.kindOf(this) for better error messages
			// -> User.find first argument must be a string (10 is a number)
			// proto.kindOf(this) + '.' + method.name + '.' + failed scheme message

			signature.sign(arguments);
			return method.apply(this, arguments);
		};

		// prototype properties
		/*
		Object.getOwnPropertyNames(this.constructor).forEach(function(name){
			Object.defineProperty(fn, name, Object.getOwnPropertyDescriptor(this.constructor, name));
		}, this);
		// instance properties
		Object.getOwnPropertyNames(this).forEach(function(name){
			Object.defineProperty(fn, name, Object.getOwnPropertyDescriptor(this, name));
		}, this);
		*/

		return fn;
	}
});

export default API;