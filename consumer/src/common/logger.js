/**
 * This module contains the winston logger configuration.
 */

import winston from 'winston';
import util from 'util';
import config from 'config';

const transports = [];
transports.push(new (winston.transports.Console)({ level: config.logLevel }));

if (config.logFile) {
  transports.push(new (winston.transports.File)({ level: config.logLevel, filename: config.logFile }));
}

const logger = new (winston.Logger)({ transports });

/**
 * Log error details with signature
 * @param err the error
 * @param signature the signature
 * @param rest the other parameters
 */
logger.logFullError = (err, signature, ...rest) => {
  if (!err) {
    return;
  }
  logger.error(signature, ...rest);
  logger.error(util.inspect(err));
  if (!err.logged) {
    logger.error(err.stack);
  }
  err.logged = true;
};

export default logger;
