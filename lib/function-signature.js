/*

TODO:
- que les messages soit customisables, non seulement le nom de la propriété (value.0 -> first argument)
mais aussi le message en lui-même, afin d'avoir des messages plus clairs puisque le schema est utilisé pour valider des arguments
on peut être plus précis

*/

import proto from 'proto';

import Schema from '../node_modules/@dmail/schema/index.js';

var FunctionSignature = proto.extend('FunctionSignature', {
	constructor(method, argumentsSignature){
		if( arguments.length === 0 ){
			throw new Error('missing method for function signature');
		}
		else if( typeof method != 'function' ){
			throw new TypeError('FunctionSignature first argument must be a function');
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
		this.argumentsSchema.validate(args);
	},

	sign(...args){
		return this.signArguments(args);
	}
});

export default FunctionSignature;

export const test = {
	modules: ['node/assert'],
	suite(add, assert){

		function assertPass(signature, value){
			assert.equal(signature.schema.firstMessage(value), "");
		}

		function assertFail(signature, value){
			assert.notEqual(signature.schema.firstMessage(value), "");
		}

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
	}
};

/*
function SignatureError(code, message = 'failed signature'){
	var error = new Error(code + ': ' + message);

	error.constructor = SignatureError;
	error.name = error.constructor.name;
	error.code = code;

	return error;
}

function createNotEnoughArgumentError(actual, expected){
	return new SignatureError('NOT_ENOUGH_ARGUMENT', 'signature expect ' + expected + ' arguments, ' + actual + ' given');
}

function createTooMuchArgumentError(actual, expected){
	return new SignatureError('TOO_MUCH_ARGUMENT', 'signature expect ' + expected + ' arguments, ' + actual + '  given');
}

function createInvalidArgumentError(actual, expected, index){
	return new SignatureError('INVALID_ARGUMENT', 'signature expect ' + expected + ' value, ' + actual + ' given');
}
*/