/**
 * Challenge general handler.
 */
import _ from 'lodash';
const co = require('co');
import Joi from 'joi';
import SalesforceEventService from '../../services/SalesforceEventService';



const userUpdatedSchema = Joi.object().keys({
  userId: Joi.number().required(),
  traitId: Joi.string().required(),
  traits: Joi.object().required(),
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
  const validatedPayload = userUpdatedSchema.validate(payload);
  logger.info('validatedPayload=> ' + JSON.stringify(validatedPayload));
  if (!validatedPayload.error) {
    const traitId = validatedPayload.value.traitId;
    // Send to salesforce only if it is one of selected traits
    if (['basic_info', 'connect_info'].indexOf(traitId) !== -1) {
      SalesforceEventService.postEvent(logger, message);
    }
  }
  return {};
});

module.exports = {
  handle,
};
