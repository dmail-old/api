import proto from 'proto';

import FunctionSignature from './function-signature.js';

var API = proto.extend('Api', {
	constructor(method){
		if( arguments.length === 0 ){
			throw new Error('API method missing');
		}
		if( typeof method != 'function' ){
			throw new TypeError('API method must be a function');
		}

		var signature;
		if( arguments.length === 1 ){
			signature = FunctionSignature.create(method);
		}
		else{
			signature = FunctionSignature.create(method, Array.prototype.slice.call(arguments, 1));
		}

		var fn = function(){
			try{
				signature.signArguments(arguments);
			}
			catch(e){
				e.message = proto.kindOf(this) + '.' + (method.name || 'anonymous') + ' ' + e.message;
				throw e;
			}

			return method.apply(this, arguments);
		};

		return fn;
	}
});

export default API;

export const test = {
	modules: ['node/assert'],
	suite(add, assert){

		add("message", function(){
			var api = API.create(function test(){}, Number);

			assert.throws(
				function(){
					api("foo");
				},
				function(e){
					return e.message == 'Undefined.test first argument must be a number (foo is a string)';
				}
			);

			var object = {
				method: API.create(function(a){})
			};

			assert.throws(
				function(){
					object.method();
				},
				function(e){
					return e.message == 'Object.anonymous arguments length must be 1 (got 0)';
				}				
			);

		});
	}
};