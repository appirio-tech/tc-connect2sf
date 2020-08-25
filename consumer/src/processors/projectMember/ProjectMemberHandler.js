/**
 * Challenge general handler.
 */
import _ from 'lodash';
const co = require('co');
import SalesforceEventService from '../../services/SalesforceEventService';

/**
 * Handle Kafka JSON message of project member created.
 *
 * @param {Object} message the Kafka JSON message
 * @param {Object} ruleSets
 *
 * @return {Promise} promise resolved to notifications
 */
const handleMemberEvent = (logger, message, ruleSets) => co(function* () {
  if (message.payload.resource === _.get(ruleSets, 'resource')) {
    logger.info(message);
    SalesforceEventService.postEvent(logger, message);
  }
  return {};
});

module.exports = {
  handleMemberEvent,
};
