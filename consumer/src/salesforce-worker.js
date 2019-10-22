import config from 'config';
import faye from 'faye';
import SalesforceService from './services/SalesforceService';

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

function start() {
  debug(config.salesforce.audience, "Salesforce Audience");
  SalesforceService.authenticate().then((authResp) => {
    debug(authResp, 'authResp');
    const { accessToken, instanceUrl } = authResp;
    client = new faye.Client(instanceUrl + '/cometd/44.0/', { timeout: 1 });
    debug('CLient created...');
    client.setHeader('Authorization', 'OAuth ' + accessToken);
    const sub = client.subscribe('/event/Connect_SFDC__e', function(message) {
        debug('Got Connect_SFDC__e', message);
    });
    debug('Subscribed')
  });
}

if (!module.parent) {
  start();
}