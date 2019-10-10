/**
 * Represents the consumer service for project events
 */

import Joi from 'joi';
import _ from 'lodash';
import config from 'config';
import {logAndValidate} from '../common/decorators';
import ConfigurationService from './ConfigurationService';
import IdentityService from './IdentityService';
import SalesforceService from './SalesforceService';
import {UnprocessableError} from '../common/errors';

const memberRole = 'customer';
const leadSource = 'Connect';
const company = 'Unknown';
const duplicateRecordRegex = /TC_Connect_Project_Id__c duplicates value on record/;

const projectCreatedSchema = Joi.object().keys({
    logger: Joi.object(),
    project: Joi.object().keys({
      id: Joi.number().required(),
      members: Joi.array().required()
    }).unknown(true)
}).unknown(true);

const projectUpdatedSchema = Joi.object().keys({
    logger: Joi.object(),
    projectEvent: Joi.object().keys({
      original: Joi.object().keys({
        id: Joi.number().required()
      }).required().unknown(true),
      updated: Joi.object().required()
    }).required()
}).unknown(true);

function getUpdatedLeadFieldData(projectUpdated) {
  const updatedLead = {};

  if (projectUpdated.status) {
    updatedLead.TC_Connect_Project_Status__c = projectUpdated.status;
  }
  
  if (projectUpdated.cancelReason) {
    updatedLead.TC_Connect_Cancel_Reason__c = projectUpdated.cancelReason;
  }
  
  if(projectUpdated.description) {
    updatedLead.TC_Connect_Description__c = projectUpdated.description;
  }

  if (projectUpdated.directProjectId) {
    updatedLead.TC_Connect_Direct_Project_Id__c = _.get(projectUpdated, "directProjectId","");
  }

  // updates the raw project JSON
  updatedLead.TC_Connect_Raw_Project__c = JSON.stringify(projectUpdated);

  return updatedLead;
}


class ConsumerService {

  /**
   * Handle a new created project
   * @param {Object} projectEvent the project event
   */
  @logAndValidate(['logger','project'], projectCreatedSchema)
  processProjectCreated(logger, project) {
    const member = _.find(project.members, {role: memberRole, isPrimary: true});
    if (!member) {
      logger.info('Project Members:');
      logger.info(project.members);
      console.log(project.members);
      throw new UnprocessableError('Cannot find primary customer');
    }
    return Promise.all([
      ConfigurationService.getSalesforceCampaignId(),
      IdentityService.getUser(member.userId),
      SalesforceService.authenticate(),
    ]).then((responses) => {
      // const campaignId = responses[0];
      // const user = responses[1];
      const { accessToken, instanceUrl } = responses[2];
      const leadData = {
        Type__c: 'connect.project.created',
        Json__c: JSON.stringify(project),
      };
      return SalesforceService.createObject('Connect_Event__c', leadData, accessToken, instanceUrl)
      .catch( (e) => {
        if (e.response && e.response.text && duplicateRecordRegex.test(e.response.text)) {
          throw new UnprocessableError(`Record existing for project ${project.id}`);
        }
        throw e;
      });
    }).catch((error) => {
      if (error.status === 400) {
        error.shouldAck = true; // ignore bad requests, most probably it is because of malformed data
      }
      throw error;
    });
  }


  /**
   * Handle created/launched project
   * @param {Object} projectEvent the project
   */
  @logAndValidate(['logger', 'projectEvent'], projectUpdatedSchema)
  processProjectUpdated(logger, projectEvent) {
    logger.debug(projectEvent)
    delete projectEvent.original.template;
    delete projectEvent.updated.template;
    var project = projectEvent.original;
    var projectUpdated = projectEvent.updated;

    return Promise.all([
      ConfigurationService.getSalesforceCampaignId(),
      SalesforceService.authenticate(),
    ]).then((responses) => {
      const campaignId = responses[0];
      const { accessToken, instanceUrl } = responses[1];

      const leadData = {
        Type__c: 'connect.project.updated',
        Json__c: JSON.stringify(projectEvent),
      };
      return SalesforceService.createObject('Connect_Event__c', leadData, accessToken, instanceUrl)
      .catch( (e) => {
        if (e.response && e.response.text && duplicateRecordRegex.test(e.response.text)) {
          throw new UnprocessableError(`Record existing for project ${projectUpdated.id}`);
        }
        throw e;
      });      
    });
  }
}

export default new ConsumerService();

