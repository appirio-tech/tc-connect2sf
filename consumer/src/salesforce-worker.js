import _ from 'lodash';
import config from 'config';
import faye from 'faye';
import SalesforceService from './services/SalesforceService';
import ProjectService from './services/ProjectService';
import logger from './common/logger';

const tcCoreLibAuth = require('tc-core-library-js').auth;

global.M2m = tcCoreLibAuth.m2m(config);

const debug = require('debug')('app:salesforce-worker');

let client = null;
process.once('SIGINT', () => {
  debug('Received SIGINT...closing connection...');
  try {
    client.disconnect();
  } catch (ignore) { // eslint-ignore-line
    logger.logFullError(ignore);
  }
  process.exit();
});

export function consumeMessage(message) {
  debug('Got Connect_SFDC__e', message);
  const payload = _.get(message, 'payload');
  const eventType = _.get(payload, 'Type__c');
  const original = JSON.parse(_.get(payload, 'Original__c'));
  const updated = JSON.parse(_.get(payload, 'Updated__c'));
  const delta = {}
  if (eventType === 'billingAccount.update') {
    const oldStatus = _.get(original, 'Active__c');
    const updatedStatus = _.get(updated, 'Active__c');
    debug(`${oldStatus} === ${updatedStatus}`);
    // billing account activated
    if (oldStatus !== updatedStatus && updatedStatus === true) {
      delta.status = 'active';
      delta.billingAccountId = parseInt(_.get(updated, 'TopCoder_Billing_Account_Id__c', 0), 10);
    }
  } else if (eventType === 'opportunity.won') {
    // TODO
  } else if (eventType === 'opportunity.lost') {
    // Cancel connect project
    delta.status = 'cancelled';
    delta.cancelReason = _.get(updated, 'Loss_Description__c', 'Opportunity Lost');
  } else if (eventType === 'opportunity.create') {
    // Move to reviewed status
    delta.status = 'reviewed';
  } else if (eventType === 'lead.status.update') {
    const oldStatus = _.get(original, 'Status');
    const updatedStatus = _.get(updated, 'Status');
    if (oldStatus !== updatedStatus) {
      if (updatedStatus === 'Nurture') {
        const nurtureReason = _.get(updated, 'Nurture_Reason__c');
        if (nurtureReason === 'BDR Rejected') {
          // Move to paused status
          delta.status = 'paused';
        }
      } else if (updatedStatus === 'Disqualified') {
        // Cancel the project
        delta.status = 'cancelled';
        delta.cancelReason = _.get(updated, 'Disqualified_Reason__c', 'Lead Disqualified');
      } else if (updatedStatus === 'Qualified') {
        // Move to reviewed status
        delta.status = 'reviewed';
      } else if (updatedStatus === 'Working') {
        // Move to in_review status
        delta.status = 'in_review';
      }
    }
  }
  let projectId = _.get(updated, 'TC_Connect_Project_ID__c');
  if (!projectId) {
    projectId = _.get(updated, 'TC_Connect_Project_Id__c');
  }
  debug(`Delta to be updated: ${JSON.stringify(delta)} for project with id ${projectId}`);
  if (delta.status && projectId) {
    debug(`Updating project with delta ${delta} with id ${projectId}`);
    ProjectService.updateProject(projectId, delta);
  }
}

function start() {
  debug(config.salesforce.audience, 'Salesforce Audience');
  SalesforceService.authenticate().then((authResp) => {
    const { accessToken, instanceUrl } = authResp;
    client = new faye.Client(`${instanceUrl}/cometd/44.0/`, { timeout: 1 });
    debug('CLient created...');
    client.setHeader('Authorization', `OAuth ${accessToken}`);
    const sub = client.subscribe('/event/Connect_SFDC__e', consumeMessage);
    debug(`Subscribed ${JSON.stringify(sub)}`);
  });
}

if (!module.parent) {
  start();
}
