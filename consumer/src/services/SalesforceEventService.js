/**
 * Represents the Rest API service for leads
 */

import {log} from '../common/decorators';
import SalesforceService from './SalesforceService';
import IdentityService from './IdentityService';

// const leadSource = 'Connect';

class SalesforceEventService {

  /**
   * Post the lead info to Salesforce
   * @param {Object} event event
   * @returns {Object} sample response
   */
  @log(['logger', 'event'])
  postEvent(logger, event) { // eslint-disable-line no-unused-vars
    logger.debug(event, 'event');
    const promises = [];
    if (event.payload.createdBy) {
        promises.push(IdentityService.getUser(event.payload.createdBy))
    }
    promises.push(SalesforceService.authenticate());
    return Promise.all(promises).then((responses) => {
      const { accessToken, instanceUrl } = responses[0];
      const event = {
        Type__c: event.topic,
        Json__c: JSON.stringify(event.payload)
      };
      return SalesforceService.createObject('Connect_Event__c', event, accessToken, instanceUrl)
      .catch( (e) => {
        throw e;
      })
    }).then((eventId) => {
      logger.debug(eventId, 'eventId');
      return {success: true, eventId };
    }).catch((error) => {
      throw error;
    });
  }

}

export default new SalesforceEventService();
