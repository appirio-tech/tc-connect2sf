/**
 * Represents the Rest API service for leads
 */

import Joi from 'joi';
import config from 'config';
import {logAndValidate} from '../common/decorators';
import ConfigurationService from './ConfigurationService';
import SalesforceService from './SalesforceService';

const postLeadSchema = Joi.object().keys({
  user: Joi.object().keys({
    firstName: Joi.string().optional(),
    lastName: Joi.string().required(),
    businessEmail: Joi.string().email().required(),
    businessPhone: Joi.string().optional(),
    title: Joi.string().required(),
    companyName: Joi.string().required(),
    companySize: Joi.string().required(),
    userName: Joi.string().required(),
    optOutMarketingEmails: Joi.bool().required(),
  }),
}).required();

const leadSource = 'Connect';

class LeadService {

  /**
   * Post the lead info to Salesforce
   * @param {Object} user Request body
   * @returns {Object} sample response
   */
  @logAndValidate(['user'], postLeadSchema)
  postLead(user) { // eslint-disable-line no-unused-vars
    console.log(user, 'user');
    let leadId = 0;
    return Promise.all([
      ConfigurationService.getSalesforceCampaignId(),
      SalesforceService.authenticate(),
    ]).then((responses) => {
      const campaignId = responses[0];
      const { accessToken, instanceUrl } = responses[1];
      const lead = {
        Title: user.title,
        FirstName: user.firstName,
        LastName: user.lastName,
        Email: user.businessEmail,
        Phone: user.businessPhone ? user.businessPhone : '',
        LeadSource: leadSource,
        Company: user.companyName,
        No_of_Employees__c: user.companySize,
        OwnerId: config.ownerId,
        TC_Handle__c: user.userName,
        HasOptedOutOfEmail: user.optOutMarketingEmails,
      };
      return SalesforceService.createObject('Lead', lead, accessToken, instanceUrl)
      .then((_leadId) => {
        leadId = _leadId;
        const campaignMember = {
          LeadId: _leadId,
          CampaignId: campaignId,
        };
        return SalesforceService.createObject('CampaignMember', campaignMember, accessToken, instanceUrl);
      }).catch( (e) => {
        throw e;
      })
    }).then(() => {
      return {success: true, leadId };
    }).catch((error) => {
      throw error;
    });
  }

}

export default new LeadService();
