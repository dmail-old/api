import proto from 'proto';

import getTypeName from '../get-type.js';

var Schema = proto.extend({
	[proto.type]: 'Schema',

	nameProperties: {
		"thenable": {
			"type": "thenable"
		},
		"iterable": {
			"type": "iterable"
		}
	},

	validators: [],

	constructor(value){
		var properties;

		if( typeof value === 'string' ){
			properties = {
				name: value
			};
		}
		else if( value === undefined || value === null ){
			properties = {};
		}
		else if( value === Object ){
			properties = {
				type: Object
			};
		}
		else if( Object.getPrototypeOf(value) === Object.prototype ){
			properties = value;
		}
		else{
			properties = {
				type: value
			};
		}

		this.properties = properties;

		if( this.has('name') ){
			var name = this.get('name');
			var nameProperties = this.nameProperties;

			if( name in nameProperties ){
				Object.assign(this.properties, nameProperties[name]);
			}
		}
	},

	has(name){
		return name in this.properties;
	},

	get(name){
		return this.properties[name];
	},

	getValue(dependencyValues){
		var value;

		if( this.has('value') ){
			value = this.get('value');
			if( typeof value === 'function' ){
				if( dependencyValues ){
					value = value.apply(this, dependencyValues);
				}
				else{
					value = value();
				}
			}
		}

		return value;
	},

	check(value){
		var validator;
		var validatorName;
		var validatorParams;
		var validatorArgs;
		var validatorValue;
		var validityState = {
			name: this.get('name'),
			value: value,
			valid: true
		};

		for(validator of this.validators){
			validatorName = validator.name;
			if( this.has(validatorName) ){
				validatorValue = this.get(validatorName);
				validatorParams = validator.getParams(validityState.value, validatorValue);
				validatorArgs = validatorParams.map(function(param){ return param.value; });

				if( false === validator.valid.apply(validator, validatorArgs) ){
					validityState.valid = false;
					validityState.validator = validatorName;
					var params = {};
					validatorParams.forEach(function(param){
						params[param.name] = param.value;
					});
					validityState.params = params;
					break;
				}
			}
		}

		return validityState;
	}
});

Schema.validators.push({
	name: 'type',

	getParams(value, schemaValue){
		return [
			{name: 'actualType', value: getTypeName(value)},
			{name: 'expectedType', value: getTypeName(schemaValue)}
		];
	},

	valid(actualType, expectedType){
		return actualType == expectedType;
	}
});

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

var CallSignature = proto.extend({
	[proto.type]: 'CallSignature',
	argumentSchemas: [],

	constructor(argumentSchemas){
		if( arguments.length > 0 ){
			if( !argumentSchemas || typeof argumentSchemas.forEach != 'function' ){
				throw new TypeError('argumentSchemas has no forEach method');
			}
			argumentSchemas.forEach(this.setArgumentSchema, this);
		}
	},

	setArgumentSchema(properties, index){
		if( false === this.hasOwnProperty('argumentSchemas') ){
			this.argumentSchemas = [];
		}
		if( arguments.length === 1 ){
			index = this.argumentSchemas.length;
		}

		this.argumentSchemas[index] = Schema.create(properties);
	},

	signArguments(argumentValues){
		var argumentSchemas = this.argumentSchemas;
		var argumentLength = argumentValues.length;
		var i = 0, j = argumentSchemas.length, argumentValue, argumentSchema, signedArgs;
		var argumentValidityState;

		if( j === 0 ){
			signedArgs = argumentValues;
		}
		else{
			signedArgs = [];

			var hasRestParam = false;

			for(;i<j;i++){
				argumentSchema = argumentSchemas[i];

				if( i === j - 1 && argumentSchema.get('name') === '...' ){
					// faut ajouter tous les arguments suivants et on a fini
					signedArgs.push.apply(signedArgs, argumentValues.slice(i));
					hasRestParam = true;
					j--;
					break;
				}
				if( i < argumentLength ){
					argumentValue = argumentValues[i];
					signedArgs[i] = argumentValue;
				}
				else{
					if( argumentSchema.has('value') ){
						argumentValue = argumentSchema.getValue(signedArgs);
						signedArgs[i] = argumentValue;
					}
				}

				argumentValidityState = argumentSchema.check(argumentValue);

				if( false === argumentValidityState.valid ){
					if( argumentValidityState.validator === 'type' ){
						throw createInvalidArgumentError(
							argumentValidityState.params.actualType,
							argumentValidityState.params.expectedType,
							i
						);
					}
					else{
						throw new Error('invalid value for argument ' + i);
					}
				}
			}

			var signedLength = signedArgs.length;
			var hasLessArgument = signedLength < j;

			if( hasLessArgument ){
				throw createNotEnoughArgumentError(argumentLength, j);
			}

			var hasMoreArgument = signedLength > j;
			if( false === hasRestParam && hasMoreArgument ){
				throw createTooMuchArgumentError(argumentLength, j);
			}
		}

		return signedArgs;
	},

	sign(){
		return this.signArguments(Array.prototype.slice.call(arguments));
	}
});

export default CallSignature;