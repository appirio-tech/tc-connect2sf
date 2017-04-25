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
      const lead = {
        FirstName: user.firstName,
        LastName: user.lastName,
        Email: user.email,
        LeadSource: leadSource,
        Company: company,
        OwnerId: config.ownerId,
        TC_Connect_Project_Id__c: project.id,
      };
      return SalesforceService.createObject('Lead', lead, accessToken, instanceUrl)
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
    }).catch((error) => {
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
    return Promise.all([
      ConfigurationService.getSalesforceCampaignId(),
      SalesforceService.authenticate(),
    ]).then((responses) => {
      const campaignId = responses[0];
      const { accessToken, instanceUrl } = responses[1];
      // queries existing lead for the project
      let sql = `SELECT id FROM Lead WHERE TC_Connect_Project_Id__c = '${project.id}'`;
      return SalesforceService.query(sql, accessToken, instanceUrl)
      .then((response) => {
        const {records: [lead]} = response;
        if (!lead) {
          throw new UnprocessableError(`Cannot find Lead with TC_Connect_Project_Id__c = '${project.id}'`);
        }
        sql = `SELECT id FROM CampaignMember WHERE LeadId = '${lead.Id}' AND CampaignId ='${campaignId}'`;
        return SalesforceService.query(sql, accessToken, instanceUrl)
        .then((response) => {
          const {records: [member]} = response;
          if (!member) {
            throw new UnprocessableError(`Cannot find CampaignMember for Lead.TC_Connect_Project_Id__c = '${project.id}'`);
          }
          return SalesforceService.deleteObject('CampaignMember', member.Id, accessToken, instanceUrl);
        })
      })
      // const {records: [lead]} = await SalesforceService.query(sql, accessToken, instanceUrl);
      // if (!lead) {
      //   throw new UnprocessableError(`Cannot find Lead with TC_Connect_Project_Id__c = '${project.id}'`);
      // }
      // sql = `SELECT id FROM CampaignMember WHERE LeadId = '${lead.Id}' AND CampaignId ='${campaignId}'`;
      // const {records: [member]} = await SalesforceService.query(sql, accessToken, instanceUrl);
      // if (!member) {
      //   throw new UnprocessableError(`Cannot find CampaignMember for Lead.TC_Connect_Project_Id__c = '${project.id}'`);
      // }
      // await SalesforceService.deleteObject('CampaignMember', member.Id, accessToken, instanceUrl);
    });
  }
}

export default new ConsumerService();

