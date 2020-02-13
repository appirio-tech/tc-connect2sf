import _ from 'lodash';
import config from 'config';
import faye from 'faye';
import SalesforceService from './services/SalesforceService';
import ProjectService from './services/ProjectService';
const tcCoreLibAuth = require('tc-core-library-js').auth;
global.M2m = tcCoreLibAuth.m2m(config);

const debug = require('debug')('app:salesforce-worker');

var client = null;
process.once('SIGINT', () => {
  debug('Received SIGINT...closing connection...')
  try {
    client.disconnect();
  } catch (ignore) { // eslint-ignore-line
    logger.logFullError(ignore)
  }
  process.exit();
});

export function consumeMessage(message) {
  debug('Got Connect_SFDC__e', message);
  const payload = _.get(message, 'payload');
  const eventType = _.get(payload, 'Type__c');
  const original = JSON.parse(_.get(payload, 'Original__c'));
  const updated = JSON.parse(_.get(payload, 'Updated__c'));
  let statusToBe = null;
  if (eventType === 'billingAccount.updated') {
    const oldStatus = _.get(original, 'Active__c');
    const updatedStatus = _.get(updated, 'Active__c');
    debug(`${oldStatus} === ${updatedStatus}`);
    if (oldStatus !== updatedStatus && updatedStatus === true) {
      statusToBe = 'active'
    }
  } else if (eventType === 'opportunity.won') {
    // TODO
  } else if (eventType === 'opportunity.lost') {
    // Cancel connect project
    statusToBe = 'cancelled'
  } else if (eventType === 'lead.disqualified') {
    // Cancel the project
    statusToBe = 'cancelled'
  } else if (eventType === 'opportunity.create') {
    // Move to reviewed status
    statusToBe = 'reviewed'
  }
  debug('updated', updated);
  const projectId = _.get(updated, 'TC_Connect_Project_ID__c');
  debug(`Updating status to ${statusToBe} project with id ${projectId}`);
  if (statusToBe && projectId) {
    ProjectService.updateProjectStatus(projectId, statusToBe);
  }
}

function start() {
  debug(config.salesforce.audience, "Salesforce Audience");
  SalesforceService.authenticate().then((authResp) => {
    const { accessToken, instanceUrl } = authResp;
    client = new faye.Client(instanceUrl + '/cometd/44.0/', { timeout: 1 });
    debug('CLient created...');
    client.setHeader('Authorization', 'OAuth ' + accessToken);
    const sub = client.subscribe('/event/Connect_SFDC__e', consumeMessage);
    debug('Subscribed')
  });
}

if (!module.parent) {
  start();
}