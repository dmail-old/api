/*


*/

import proto from 'proto';

import Schema from '../node_modules/@dmail/schema/index.js';
import SortedArray from '../node_modules/@dmail/schema/lib/util/array-sorted.js';

function SignatureError(code, message = 'failed signature'){
	var error = new Error(message);

	error.constructor = SignatureError;
	error.name = error.constructor.name;
	error.code = code;

	return error;
}

function fixErrorStack(error){
	var stackTrace = platform.trace(error);
	var callSites = stackTrace.callSites;

	var externalCallSiteIndex = callSites.findIndex(function(callSite){
		return callSite.getFunctionName() === '__signedFunction__';
	});

	error.stackTrace.callSites = callSites.slice(externalCallSiteIndex + 1);
}

var FunctionSignature = proto.extend('FunctionSignature', {
	name: 'anonymous',
	params: {
		name(difference){
			var path = difference.property.path;
			var propertyName = difference.property.name;
			var parts = path.concat(propertyName);
			var name;

			if( parts.length === 1 ){
				name = 'arguments';
			}
			else{
				var argumentName = parts[1];
				
				if( argumentName === '0' ){
					name = 'first argument';
				}
				else if( argumentName === '1' ){
					name = 'second argument';
				}
				else{
					name = 'argument n°' + argumentName;
				}

				if( parts.length > 2 ){
					name+= ' ' + parts.slice(2).join('.');
				}				
			}

			return name;
		},
		propertiesName(){ return ''; },
	},

	constructor(method, argumentsSignature){
		if( arguments.length === 0 ){
			throw new Error('missing method for function signature');
		}
		else if( typeof method != 'function' ){
			throw new TypeError('FunctionSignature first argument must be a function');
		}

		if( method.name ){
			this.name = method.name;
		}

		var definition = {};

		// definition.is = 'arguments'; // could be added to the is keyword, using arguments.callee but too restrictive
		definition.type = 'object';

		if( arguments.length === 1 ){
			// if no definition is provided, just check that the number of arguments equals method.length
			definition.minProperties = method.length;
			definition.maxProperties = method.length;
		}
		else{
			var i = 0, j = argumentsSignature.length, argumentSignature;
			var properties = {};
			var hasRestParam = false;

			for(;i<j;i++){
				argumentSignature = argumentsSignature[i];
				if( i === j-1 && argumentSignature === '...' ){
					hasRestParam = true;
					j--;
				}
				else{
					properties[i] = this.createPropertyDefinitionFromArgumentSignature(argumentSignature);
				}
			}

			definition.properties = properties;
			definition.minProperties = j;
			definition.additionalProperties = hasRestParam ? true : false;
		}		

		this.schema = Schema.create(definition);
	},

	createPropertyDefinitionFromArgumentSignature(signature){
		var definition = {};

		if( typeof signature === 'string' ){
			definition.kind = signature;
		}
		else if( signature === undefined || signature === null ){
			definition.equal = signature;
		}
		else if( Object.getPrototypeOf(signature) === Object.prototype ){
			definition = signature;
		}
		else if( typeof signature === 'function' ){
			definition.kind = signature.name;
		}
		else{
			definition.kind = proto.kindOf(signature);
		}

		return definition;
	},

	signArguments(args){
		var group = this.schema.firstGroup(args);

		if( group ){
			throw new SignatureError(group.name, group.createMessage(this.params));
		}
	},

	sign(...args){
		return this.signArguments(args);
	},

	apply(bind, args){
		var method = this.method;

		try{
			this.signArguments(args);
		}
		catch(e){
			var prefix = '';

			if( bind !== null && bind !== undefined ){
				prefix = proto.kindOf(bind) + '.';
			}
			e.message = prefix + this.name + ' ' + e.message;

			fixErrorStack(e);

			throw e;
		}

		return method.apply(bind, args);
	},

	asFunction(){
		var signature = this;

		function __signedFunction__(){
			return signature.apply(this, arguments);
		}
		__signedFunction__.signature = signature;

		return __signedFunction__;
	}
});

var SignatureList = proto.extend('SignatureList', {
	constructor(){
		this.signatures = [];
	},

	getSignatureOrder(signature){
		return signature.schema.get('minProperties');
	},

	compareSignature(a, b){
		return this.getSignatureOrder(a) - this.getSignatureOrder(b);
	},

	add(fn, schema){
		var signature = FunctionSignature.create.apply(FunctionSignature, arguments);

		// keep signature sorted to match most complex first, it's part of the logic
		SortedArray.add(this.signatures, this.compareSignature.bind(this), signature);

		return signature;
	},

	apply(bind, args){
		var differences = [], valid;

		for(var signature of this.signatures){
			try{
				signature.apply(bind, args);
				valid = signature;
			}
			catch(e){
				differences.push(e);
			}
		}

		if( !valid ){
			var error = new SignatureError('anyOf', differences.map(function(e){
				return e.message;
			}).join(' OR '));

			fixErrorStack(error);

			throw error;
		}
	},

	asFunction: FunctionSignature.asFunction
});

var API = proto.extend('Api', {
	constructor(method){
		var signature;
		if( arguments.length === 1 ){
			signature = FunctionSignature.create(method);
		}
		else{
			signature = FunctionSignature.create(method, Array.prototype.slice.call(arguments, 1));
		}

		return signature.asFunction();
	}
});

var Polymorph = proto.extend('Polymorph', {
	constructor(){
		var signatureList = SignatureList.create();
		var args = arguments, i = 0, j = args.length, arg, signature;

		if( typeof args[0] === 'string' ){
			this.name = args[0];
			i = 1;
		}

		for(;i<j;i++){
			arg = args[i];

			if( typeof arg === 'function' ){
				signature = signatureList.add(arg);
			}
			else if( typeof arg === 'object' && i < j-1 ){
				i++;
				signature = signatureList.add(args[i], arg);
			}

			if( false === signature.hasOwnProperty('name') ){
				signature.name = this.name;
			}
		}

		return signatureList.asFunction();
	}
});

function api(){
	return API.create.apply(API, arguments);
}

function polymorph(){
	return Polymorph.create.apply(Polymorph, arguments);
}

var exports = function(){ return api.apply(this, arguments); };
exports.polymorph = polymorph;

export default exports;

export const test = {
	modules: ['node/assert'],
	suite(add, assert){

		function assertPass(signature, value){
			assert.equal(signature.schema.firstMessage(value), "");
		}

		function assertFail(signature, value){
			assert.notEqual(signature.schema.firstMessage(value), "");
		}

		// function signature
		add("function signature", function(){
			var signature = FunctionSignature.create(
				function(){},
				[Number, String]
			);
			
			assertFail(signature, [10]); // not enough
			assertFail(signature, [10, "", undefined]); // too much
			assertFail(signature, [false, ""]); // first arg is wrong type
			assertFail(signature, [10, false]); // second arg wrong type
			assertPass(signature, [10, ""]);
		});

		add("rest args", function(){
			var signature = FunctionSignature.create(
				function(){},
				[Number, '...']
			);

			assertFail(signature, []);
			assertPass(signature, [10]);
			assertPass(signature, [10, true]);
			assertPass(signature, [10, false, '']);

		});

		add("function length signature only", function(){
			var signature = FunctionSignature.create(function(a){});

			assertFail(signature, []);
			assertFail(signature, [0,1]);
			assertPass(signature, [0]);

		});

		add("default arg value with dependency", function(){
			var signature = FunctionSignature.create(
				function(){},
				[
					{default(){ return 10; }},
					{default(a){ return a + 1; }}
				]
			);

			var value = [];
			assertPass(signature, value);
			assert.equal(value[0], 10);
			assert.equal(value[1], 11);

		});

		add("signature message", function(){
			var signature = FunctionSignature.create(function(){}, [Number]);

			assert.throws(
				function(){
					signature.sign("foo");
				},
				function(e){
					return e.name == 'SignatureError' && e.message == 'first argument must be a number (foo is a string)';
				}
			);			

		});

		// API
		add("api message", function(){
			var method = api(function test(){}, Number);

			assert.throws(
				function(){
					method("foo");
				},
				function(e){
					return e.message == 'test first argument must be a number (foo is a string)';
				}
			);

			var object = {
				method: api(function(a){})
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

		// the error trace must start with the call to the method
		add("api error trace", function(){
			var method = api(function test(a){});
			var trace;

			assert.throws(
				function(){
					trace = platform.trace();
					method();
				},
				function(e){
					return e.lineNumber === trace.lineNumber + 1 && e.fileName == trace.fileName;
				}
			);		

		});

		// polymorph
		add("polymorph message", function(){
			var method = polymorph(
				'method',
				function(a){},
				function(a, b){}
			);

			assert.throws(
				function(){
					method();
				},
				function(e){
					return e.message === 'method arguments length must be 1 (got 0) OR method arguments length must be 2 (got 0)';
				}
			);

		});
	}
};