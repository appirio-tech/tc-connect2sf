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
      const campaignId = responses[0];
      const user = responses[1];
      const { accessToken, instanceUrl } = responses[2];
      const leadData = {
        FirstName: user.firstName,
        LastName: user.lastName,
        Email: user.email,
        LeadSource: leadSource,
        Company: company,
        OwnerId: config.ownerId,
        TC_Handle__c: user.handle,
        TC_Connect_Project_Id__c: project.id,
        TC_Connect_Description__c: _.get(project,"description",""),
        TC_Connect_Project_Status__c: _.get(project,"status",""),
        TC_Connect_Direct_Project_Id__c: _.get(project, "directProjectId",""),
        TC_Connect_Cancel_Reason__c: _.get(project,"cancelReason",""),
        TC_Connect_Raw_Project__c: JSON.stringify(project),
      };
      let sql = `SELECT id,IsConverted FROM Lead WHERE Email = '${project.id}' AND LeadSource = 'Connect'`;
      return SalesforceService.query(sql, accessToken, instanceUrl)
      .then((response) => {
        const {records: [lead]} = response;
        if (!lead) {
          // if lead does not exists, create new one
          return SalesforceService.createObject('Lead', leadData, accessToken, instanceUrl)
          .then((leadId) => {
            const campaignMember = {
              LeadId: leadId,
              CampaignId: campaignId,
            };
            return SalesforceService.createObject('CampaignMember', campaignMember, accessToken, instanceUrl);
          }).catch( (e) => {
            if (e.response && e.response.text && duplicateRecordRegex.test(e.response.text)) {
              throw new UnprocessableError(`Lead already existing for project ${project.id}`);
            }
            throw e;
          })
        } else {
          // if lead does exists update it with project data
          if (lead.IsConverted != true && !_.isEmpty(leadData)) {
            return SalesforceService.updateObject(lead.Id, 'Lead', leadData, accessToken, instanceUrl);
          }
        }
      })
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
    var project = projectEvent.original;
    var projectUpdated = projectEvent.updated;

    return Promise.all([
      ConfigurationService.getSalesforceCampaignId(),
      SalesforceService.authenticate(),
    ]).then((responses) => {
      const campaignId = responses[0];
      const { accessToken, instanceUrl } = responses[1];

      // queries existing lead for the project
      let sql = `SELECT id,IsConverted FROM Lead WHERE TC_Connect_Project_Id__c = '${project.id}'`;
      return SalesforceService.query(sql, accessToken, instanceUrl)
      .then((response) => {
        const {records: [lead]} = response;
        if (!lead) {
           throw new UnprocessableError(`Cannot find Lead with TC_Connect_Project_Id__c = '${project.id}'`);
        }
        
        const leadUpdate = getUpdatedLeadFieldData(projectUpdated);

        if (lead.IsConverted != true && !_.isEmpty(leadUpdate)) {
          return SalesforceService.updateObject(lead.Id, 'Lead', leadUpdate, accessToken, instanceUrl);
        }

        // sql = `SELECT id FROM CampaignMember WHERE LeadId = '${lead.Id}' AND CampaignId ='${campaignId}'`;
        // return SalesforceService.query(sql, accessToken, instanceUrl)
        // .then((response) => {
          // const {records: [member]} = response;
          // if (!member) {
          //  throw new UnprocessableError(`Cannot find CampaignMember for Lead.TC_Connect_Project_Id__c = '${project.id}'`);
          // }
          // return SalesforceService.deleteObject('CampaignMember', member.Id, accessToken, instanceUrl);
        // })
      }).catch((error) => {
        if (error.status === 400) {
          error.shouldAck = true; // ignore bad requests, most probably it is because of malformed data
        }
        throw error;
      });
    });
  }
}

export default new ConsumerService();

