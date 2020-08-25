/**
 * Challenge general handler.
 */
import _ from 'lodash';
const co = require('co');
import Joi from 'joi';
import SalesforceEventService from '../../services/SalesforceEventService';



const userCreatedSchema = Joi.object().keys({
  id: Joi.string().required(),
  handle: Joi.string().required(),
  email: Joi.string().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
}).unknown(true);

/**
 * Handle Kafka JSON message of challenge created.
 *
 * @param {Object} message the Kafka JSON message
 * @param {Object} ruleSets
 *
 * @return {Promise} promise resolved to notifications
 */
const handle = (logger, message, ruleSets) => co(function* () {
  const payload = message.payload;
  const validatedPayload = userCreatedSchema.validate(payload);
  logger.info(validatedPayload, 'validatedPayload');
  if (!validatedPayload.error) {
    SalesforceEventService.postEvent(logger, message);
  }
  return {};
});

module.exports = {
  handle,
};
