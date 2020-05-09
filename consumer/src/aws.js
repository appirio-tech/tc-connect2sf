/**
 * Setup configuration for AWS services.
 **/

import AWS from 'aws-sdk';
import config from 'config';

AWS.config.apiVersions = {
  dynamodb: '2012-08-10',
};
AWS.config.update({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region,
});

let endpoint;
if (config.aws.endpoint) {
  endpoint = new AWS.Endpoint(config.aws.endpoint);
}

export const dynamodb = endpoint ? new AWS.DynamoDB({endpoint}) : new AWS.DynamoDB();
