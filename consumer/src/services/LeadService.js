/**
 * Represents the Rest API service for leads
 */

import Joi from 'joi';
import {logAndValidate} from '../common/decorators';
import SalesforceService from './SalesforceService';

const postLeadSchema = Joi.object().keys({
  user: Joi.object().keys({
    firstName: Joi.string().optional(),
    lastName: Joi.string().required(),
    businessEmail: Joi.string().email().required(),
    businessPhone: Joi.string().optional(),
    title: Joi.string().required(),
    companyName: Joi.string().required(),
    companySize: Joi.string().optional(),
    userName: Joi.string().required(),
    userId: Joi.number().optional(),
    optOutMarketingEmails: Joi.bool().optional(),
  }),
}).required();

// const leadSource = 'Connect';

class LeadService {

  /**
   * Post the lead info to Salesforce
   * @param {Object} user Request body
   * @returns {Object} sample response
   */
  @logAndValidate(['user'], postLeadSchema)
  postLead(user) { // eslint-disable-line no-unused-vars
    console.log(user, 'user');
    const leadId = 0;
    return Promise.all([
      SalesforceService.authenticate(),
    ]).then((responses) => {
      const { accessToken, instanceUrl } = responses[0];
      const lead = {
        Type__c: 'connect.user.registered',
        Json__c: JSON.stringify(user),
      };
      return SalesforceService.createObject('Connect_Event__c', lead, accessToken, instanceUrl)
      .catch((e) => {
        throw e;
      });
    }).then(() => ({success: true, leadId })).catch((error) => {
      throw error;
    });
  }

}

export default new LeadService();
