/**
 * This module contains decorators
 */

import _ from 'lodash';
import Joi from 'joi';
import util from 'util';
import debug from 'debug';
import logger from './logger';

/**
 * Remove invalid properties from the object and hide long arrays
 * @param {Object} obj the object
 * @returns {Object} the new object with removed properties
 * @private
 */
function _sanitizeObject(obj) {
  try {
    return JSON.parse(JSON.stringify(obj, (name, value) => {
      // Array of field names that should not be logged
      // add field if necessary (password, tokens etc)
      const removeFields = ['jwtToken', 'accessToken'];
      if (_.includes(removeFields, name)) {
        return '<removed>';
      }
      if (_.isArray(value) && value.length > 30) {
        return `Array(${value.length})`;
      }
      return value;
    }));
  } catch (e) {
    return obj;
  }
}

/**
 * Convert array with arguments to object
 * @param {Array} params the name of parameters
 * @param {Array} arr the array with values
 * @private
 */
function _combineObject(params, arr) {
  const ret = {};
  _.each(arr, (arg, i) => {
    ret[params[i]] = arg;
  });
  return ret;
}

/**
 * Decorator for logging input and output arguments (debug mode)
 * and logging errors
 * @param {Object} params the method parameters
 * @param {bool} removeOutput true if don't log output (e.g. sensitive data)
 * @returns {Function} the decorator
 */
export function log(params = [], {removeOutput} = {}) {
  return (target, methodName, descriptor) => {
    const method = descriptor.value;
    const signature = `${target.constructor.name}#${methodName}`;
    const logDebug = target.logDebug || debug(`app:${target.constructor.name}`);
    target.logDebug = logDebug;

    const logExit = (output) => {
      logDebug(`EXIT ${methodName}`);
      if (output !== null && output !== undefined) {
        let outputLog = '';
        if (removeOutput) {
          outputLog = '<removed>';
        } else {
          outputLog = util.inspect(_sanitizeObject(output));
        }
        logDebug('output: ' + outputLog);
      }
      return output;
    };
    descriptor.value = function logDecorator(...args) {
      logDebug(`ENTER ${methodName}`);
      if (params.length) {
        logDebug('input arguments: ' + util.inspect(_sanitizeObject(_combineObject(params, args))));
      }
      let result;

      try {
        result = method.apply(this, args);
      } catch (e) {
        logger.logFullError(e, signature);
        throw e;
      }
      // promise (or async function)
      if (result && _.isFunction(result.then)) {
        return result.then((asyncResult) => {
          logExit(asyncResult);
          return asyncResult;
        }).catch((e) => {
          logger.logFullError(e, signature);
          throw e;
        });
      }
      logExit(result);
      return result;
    };
    return descriptor;
  };
}

/**
 * Decorator for validating with Joi
 * @param {Object} params the method parameters
 * @param {Object} schema the joi schema
 * @returns {Function} the decorator
 */
export function validate(params, schema) {
  return (target, methodName, descriptor) => {
    const method = descriptor.value;
    descriptor.value = function validateDecorator(...args) {
      const value = _combineObject(params, args);
      const normalized = Joi.attempt(value, schema);
      const newArgs = [];
      // Joi will normalize values
      // for example string number '1' to 1
      // if schema type is number
      _.each(params, (param) => {
        newArgs.push(normalized[param]);
      });
      return method.apply(this, newArgs);
    };
  };
}

/**
 * Combine Log and Validate decorators
 * @param {Object} params the method parameters
 * @param {Object} schema the joi schema
 * @returns {Function} the decorator
 */
export function logAndValidate(params, schema) {
  return function logDecorator(target, methodName, descriptor) {
    validate(params, schema)(target, methodName, descriptor);
    log(params, schema)(target, methodName, descriptor);
  };
}
