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
  @log(['event'])
  postEvent(logger, event) { // eslint-disable-line no-unused-vars
    logger.debug(event, 'event');
    const promises = [];
    if (event.payload.createdBy) {
        promises.push(IdentityService.getUser(event.payload.createdBy))
    }
    promises.push(SalesforceService.authenticate());
    return Promise.all(promises).then((responses) => {
      if (promises.length > 1) {
        const user = responses[0];
        event.payload.createdByEmail = user.email;
        event.payload.createdByFirstName = user.firstName;
        event.payload.createdByLastName = user.lastName;
      }
      const { accessToken, instanceUrl } = promises.length > 1 ? responses[1] : responses[0];
      const evt = {
        Type__c: event.topic,
        Json__c: JSON.stringify(event.payload)
      };
      return SalesforceService.createObject('Connect_Event__c', evt, accessToken, instanceUrl)
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
