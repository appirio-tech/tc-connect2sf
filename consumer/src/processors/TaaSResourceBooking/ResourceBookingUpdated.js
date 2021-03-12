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
  SalesforceEventService.postEvent(logger, message);
  return {};
});

module.exports = {
  handle,
};