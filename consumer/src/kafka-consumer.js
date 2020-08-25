/**
 * Kafka consumer
 */
'use strict';

const config = require('config');
const _ = require('lodash');
const Kafka = require('no-kafka');
const co = require('co');
const Promise = require('bluebird');
const healthcheck = require('topcoder-healthcheck-dropin');

import logger from './common/logger';
const processors = require('./processors');


/**
 * Start Kafka consumer
 */
function startKafkaConsumer() {
  const options = {
    groupId: config.kafka.KAFKA_GROUP_ID,
    connectionString: config.kafka.KAFKA_URL,
  };
  const cert = config.kafka.KAFKA_CLIENT_CERT.replace(/\\n/g, '\n');
  const key = config.kafka.KAFKA_CLIENT_CERT_KEY.replace(/\\n/g, '\n');
  if (config.kafka.KAFKA_CLIENT_CERT && config.kafka.KAFKA_CLIENT_CERT_KEY) {
    options.ssl = {
      cert,
      key,
    };
  };
  const consumer = new Kafka.GroupConsumer(options);

  // data handler
  const messageHandler = (messageSet, topic, partition) => Promise.each(messageSet, (m) => {
    const message = m.message.value.toString('utf8');
    logger.info(`Handle Kafka event message; Topic: ${topic}; Partition: ${partition}; Offset: ${
      m.offset}; Message: ${message}.`);

    let messageJSON;
    try {
      messageJSON = JSON.parse(message);
    } catch (e) {
      logger.error('Invalid message JSON.');
      logger.logFullError(e);
      // commit the message and ignore it
      consumer.commitOffset({ topic, partition, offset: m.offset });
      return;
    }

    if (messageJSON.topic !== topic) {
      logger.error(`The message topic ${messageJSON.topic} doesn't match the Kafka topic ${topic}.`);
      // commit the message and ignore it
      consumer.commitOffset({ topic, partition, offset: m.offset });
      return;
    }

    // get rule sets for the topic
    const ruleSets = config.KAFKA_CONSUMER_RULESETS[topic];

    // TODO for NULL handler
    if (!ruleSets || ruleSets.length === 0) {
      logger.error(`No handler configured for Kafka topic ${topic}.`);
      // commit the message and ignore it
      consumer.commitOffset({ topic, partition, offset: m.offset });
      return;
    }

    return co(function* () {
      // run each handler
      for (let i = 0; i < ruleSets.length; i += 1) {
        const rule = ruleSets[i];
        const handlerFuncArr = _.keys(rule);
        const handlerFuncName = _.get(handlerFuncArr, '0');

        try {
          const handler = processors[handlerFuncName];
          const handlerRuleSets = rule[handlerFuncName];
          if (!handler) {
            logger.error(`Handler ${handlerFuncName} is not defined`);
            continue;
          }
          logger.info(`Run handler ${handlerFuncName}`);
          // run handler to get notifications
          const notifications = yield handler(logger, messageJSON, handlerRuleSets);
          logger.info(`Handler ${handlerFuncName} executed successfully`);
        } catch (e) {
          // log and ignore error, so that it won't block rest handlers
          logger.error(`Handler ${handlerFuncName} failed`);
          logger.logFullError(e);
        }
      }
    })
      // commit offset
      .then(() => consumer.commitOffset({ topic, partition, offset: m.offset }))
      .catch((err) => {
        logger.error('Kafka handler failed');
        logger.logFullError(err);
      });
  });

  const check = function () {
    if (!consumer.client.initialBrokers && !consumer.client.initialBrokers.length) {
      return false;
    }
    let connected = true;
    consumer.client.initialBrokers.forEach(conn => {
      logger.debug(`url ${conn.server()} - connected=${conn.connected}`);
      connected = conn.connected & connected;
    });
    return connected;
  };

  // Start kafka consumer
  logger.info('Starting kafka consumer');
  consumer
    .init([{
      // subscribe topics
      subscriptions: _.keys(config.KAFKA_CONSUMER_RULESETS),
      handler: messageHandler,
    }])
    .then(() => {
      logger.info('Kafka consumer initialized successfully');
      healthcheck.init([check]);
    })
    .catch((err) => {
      logger.error('Kafka consumer failed');
      logger.logFullError(err);
    });
}



if (!module.parent) {
    startKafkaConsumer(); 
}
