/**
 * Challenge general handler.
 */
import _ from 'lodash';
const co = require('co');
import Joi from 'joi';
import SalesforceEventService from '../../services/SalesforceEventService';

ResourceBookingCreatedSchema = Joi.object().keys({
    currentUser: Joi.object().required(),
    resourceBooking: Joi.object().keys({
      status: Joi.jobStatus().default('sourcing'),
      projectId: Joi.number().integer().required(),
      userId: Joi.string().uuid().required(),
      jobId: Joi.string().uuid().allow(null),
      startDate: Joi.date().allow(null),
      endDate: Joi.date().allow(null),
      memberRate: Joi.number().allow(null),
      customerRate: Joi.number().allow(null),
      rateType: Joi.rateType().required()
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
  const validatedPayload = ResourceBookingCreatedSchema.validate(payload);
  logger.info('validatedPayload=>' + JSON.stringify(validatedPayload));
  if (!validatedPayload.error) {
    SalesforceEventService.postEvent(logger, message);
  }
  return {};
});

module.exports = {
  handle,
};