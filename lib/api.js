import proto from 'proto';

import CallSignature from './call-signature.js';

var API = proto.extend('API', {
	constructor(method){
		if( arguments.length === 0 ){
			throw new Error('API method missing');
		}
		if( typeof method != 'function' ){
			throw new TypeError('API method must be a function');
		}

		var argumentSchemas ;
		// if there is no argumentSchemas, force only the length from method.length
		if( arguments.length === 1 ){
			argumentSchemas = new Array(method.length);
		}
		else{
			argumentSchemas = Array.prototype.slice.call(arguments, 1);
		}

		var signature = CallSignature.create(argumentSchemas);
		var self = this;
		var fn = function(){
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