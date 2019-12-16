/**
 * Represents the consumer service for project events
 */

import Joi from 'joi';
import _ from 'lodash';
import {log, validate} from '../common/decorators';
import IdentityService from './IdentityService';
import SalesforceService from './SalesforceService';
import {UnprocessableError} from '../common/errors';

const memberRole = 'customer';
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
  @log(['project'])
  @validate(['logger','project'], projectCreatedSchema)
  processProjectCreated(logger, project) {
    const member = _.find(project.members, {role: memberRole, isPrimary: true});
    if (!member) {
      logger.info('Project Members:');
      logger.info(project.members);
      throw new UnprocessableError('Cannot find primary customer');
    }
    return Promise.all([
      IdentityService.getUser(member.userId),
      SalesforceService.authenticate(),
    ]).then((responses) => {
      const user = responses[0];
      project.createdByEmail = user.email;
      const { accessToken, instanceUrl } = responses[1];
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
  @log(['projectEvent'])
  @validate(['logger', 'projectEvent'], projectUpdatedSchema)
  processProjectUpdated(logger, projectEvent) {
    logger.debug(projectEvent)
    delete projectEvent.original.template;
    delete projectEvent.updated.template;
    var project = projectEvent.original;
    var projectUpdated = projectEvent.updated;

    return Promise.all([
      IdentityService.getUser(project.createdBy),
      SalesforceService.authenticate(),
    ]).then((responses) => {
      const user = responses[0];
      const { accessToken, instanceUrl } = responses[1];
      projectEvent.original.createdByEmail = user.email;

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

