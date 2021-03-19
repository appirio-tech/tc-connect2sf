/**
 * Challenge general handler.
 */
import _ from 'lodash';
const co = require('co');
import SalesforceEventService from '../../services/SalesforceEventService';

/**
 * Handle Kafka JSON message of TaaS Resource Booking updated.
 *
 * @param {Object} message the Kafka JSON message
 * @param {Object} ruleSets
 *
 * @return {Promise}
 */
const handle = (logger, message, ruleSets) => co(function* () {
  logger.info(message);

  // we cannot pass `createdBy` because it hold V5 User UUID not V3 User numeric id
  // as a results when we `postEvent` we would try to populate user details which would fail
  // see https://github.com/appirio-tech/tc-connect2sf/issues/81 for details
  const cleanMessage = _.omit(message, 'payload.createdBy');

  logger.info('message to send', cleanMessage);
  SalesforceEventService.postEvent(logger, cleanMessage);
  return {};
});

module.exports = {
  handle,
};