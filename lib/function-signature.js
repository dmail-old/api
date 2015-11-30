import proto from 'proto';

import Schema from '../node_modules/@dmail/schema/index.js';

function SignatureError(message){
	var error = new Error(message || 'failed signature');

	error.constructor = SignatureError;
	error.name = error.constructor.name;

	return error;
}

function createNotEnoughArgumentError(actual, expected){
	var error = new SignatureError('NOT_ENOUGH_ARGUMENT: signature expect ' + expected + ' arguments, ' + actual + ' given');
	error.code = 'NOT_ENOUGH_ARGUMENT';
	return error;
}

function createTooMuchArgumentError(actual, expected){
	var error = new SignatureError('TOO_MUCH_ARGUMENT: signature expect ' + expected + ' arguments, ' + actual + '  given');
	error.code = 'TOO_MUCH_ARGUMENT';
	return error;
}

function createInvalidArgumentError(actual, expected, index){
	var error = new SignatureError('INVALID_ARGUMENT: signature expect ' + expected + ' value, ' + actual + ' given');
	error.code = 'INVALID_ARGUMENT';
	return error;
}

/*
TODO : differentiate MISSING_PROPERTY from NOT_ENOUGH_ARGUMENT
TOO_MUCH_PROPERTIES however is forced by additionalProperties set to false or by maxProperties

TODO : handle default argument values
*/

var FunctionSignature = proto.extend('FunctionSignature', {
	constructor(method, argumentsPropertiesDefinition){
		if( arguments.length === 0 ){
			throw new Error('missing method for function signature');
		}
		else if( typeof method != 'function' ){
			throw new TypeError('FunctionSignature first argument must be a function');
		}

		var argumentsDefinition;
		if( arguments.length === 1 ){
			// if no definition is provided, just check that the number of arguments equals method.length
			argumentsDefinition = {
				minProperties: method.length,
				maxProperties: method.length
			};
		}
		else{
			argumentsDefinition = {
				properties: argumentsPropertiesDefinition
			};

			if( argumentsPropertiesDefinition[argumentsPropertiesDefinition.length - 1] === '...' ){
				argumentsPropertiesDefinition.pop();
				argumentsDefinition.additionalProperties = true; // allow additional properties when rest params is presetn
			}
			else{
				argumentsDefinition.additionalProperties = false;
			}
		}

		this.argumentsSchema = Schema.create(argumentsDefinition);
	},

	signArguments(args){
		this.argumentsSchema.validate(args);
	},

	sign(){
		return this.signArguments(Array.prototype.slice.call(arguments));
	}
});

function render(string, object){
	return string.replace(/\\?\{([^{}]+)\}/g, function(match, name){
		if( match.charAt(0) == '\\' ) return match.slice(1);
		return object[name] != null ? object[name] : '';
	});
}

function failedArgumentValidationMessage(result){
	var message;

	// we could obtain the same behaviour saying property 0, 1 are named first argument, second argument
	if( result.reason == 'INVALID_PROPERTY' ){
		var propertyPath = result.params.propertyPath;
		var propertyNames = propertyPath.split('.');
		var argumentIndex = propertyNames[0];
		var argumentName;

		if( argumentIndex === 0 ){
			argumentName = 'first argument';
		}
		else if( argumentIndex === 1 ){
			argumentName = 'second argument';
		}
		else{
			argumentName = 'argument n°' + argumentIndex;
		}

		if( propertyNames.length > 1 ){
			if( result.reason === 'MISSING_PROPERTY' ){
				message = 'the ' + argumentName + ' is missing';
			}
			else{
				message = 'the ' + argumentName + ' is invalid : ';
				message+= result.createMessage(result.params.reason, result.params.params);
			}
		}
		else{
			if( propertyNames.length == 2 ){
				message = argumentName + ' invalid ' + propertyNames[1] + ' property : ';
			}
			else{
				message = argumentName + ' invalid property at ' + propertyNames.slice(1).join('.') + ' : ';
			}

			message+= result.createMessage(result.params.reason, result.params.params);
		}
	}
	else if( result.reason === 'NOT_ENOUGH_PROPERTIES' ){
		message = render('signature expect min {expectedLimit} arguments, {actualLength} given', result.params);
	}
	else if( result.reason === 'TOO_MUCH_PROPERTIES' ){
		message = render('signature expect max {expectedLimit} arguments, {actualLength} given', result.params);
	}

	return message;
}

/*

for polymorph

I'll have to know what is accepted regarding what failed
For instance

INVALID_PROPERTY
	FORBIDDEN_VALUE : first argument invalid name property : the value null is forbidden
	-> ok
	INVALID_VALUE_TYPE : the first argument is invalid : value type must be string, number given
	-> the first argument is invalid : it can be one of string,object, number given
	-> the first argument is invalid : it must be a string, number given
	INVALID_VALUE_KIND
	-> same as type
	DIFFERENT_VALUE: the first argument is invalid : value must be 10, got 5
	-> the first argument is invalid : it can be one of 10,12,15, got 5
	-> same as type
	TOO_LONG_STRING: the first argument is invalid : string length must be less than 10, got 15
	-> the first argument is invalid : string length must be less than 12, got 15 (get the max value from signatures)
	TOO_SHORT_STRING
	-> same as too_long_string
	INVALID_STRING : the first argument is invalid : string must verify the regexp /ok/
	the first argument is invalid : string must verify on of the regexp /ok/
	TOO_BIG_NUMBER, TOO_SMALL_NUMBER
	-> same as too_long_string
	MISSING_PROPERTY : first argument invalid property at '0.name' : property is missing
	-> ok
	DUPLICATE_PROPERTy : first argument invalid property at 'name' : 'damien' found for key 0, & 1
	-> first argument invalid property at 'name' : 'damien' found in the second argument
TOO_MUCH_PROPERTIES
-> same as too_long_string (take max of all signatures)
NOT_ENOUGH_PROPERTIES -> signature expect min 3 arguments, 2 given
-> same as too_short_string
DUPLICATE_VALUE
-> should not happen because argumentsDefinition should write {uniqueValues: true}
-> expecting arguments to be unique, it's not a planned feature atm

*/

export default FunctionSignature;