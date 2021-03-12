/**
 * Challenge general handler.
 */
import _ from 'lodash';
const co = require('co');
import Joi from 'joi';
import SalesforceEventService from '../../services/SalesforceEventService';

ResourceBookingUpdatedSchema = Joi.object().keys({
    currentUser: Joi.object().required(),
    id: Joi.string().uuid().required(),
    data: Joi.object().keys({
      status: Joi.jobStatus(),
      startDate: Joi.date().allow(null),
      endDate: Joi.date().allow(null),
      memberRate: Joi.number().allow(null),
      customerRate: Joi.number().allow(null),
      rateType: Joi.rateType()
    }).required()
  }).required()


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
  const validatedPayload = ResourceBookingUpdatedSchema.validate(payload);
  logger.info('validatedPayload=>' + JSON.stringify(validatedPayload));
  if (!validatedPayload.error) {
    SalesforceEventService.postEvent(logger, message);
  }
  return {};
});

module.exports = {
  handle,
};