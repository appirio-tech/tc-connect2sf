/**
 * The main app entry
 */

import config from 'config';
import amqp from 'amqplib';
import _ from 'lodash';
import cron from 'node-cron';
import logger from './common/logger';
import ConsumerService from './services/ConsumerService';
import { EVENT } from '../config/constants';

const tcCoreLibAuth = require('tc-core-library-js').auth;

global.M2m = tcCoreLibAuth.m2m(config);

const debug = require('debug')('app:worker');

const FETCH_LIMIT = 10;

let connection;
let scheduledConnection;
process.once('SIGINT', () => {
  debug('Received SIGINT...closing connection...');
  try {
    connection.close();
  } catch (ignore) {
    logger.logFullError(ignore);
  }
  try {
    scheduledConnection.close();
  } catch (ignore) {
    logger.logFullError(ignore);
  }
  process.exit();
});

let EVENT_HANDLERS = {
  [EVENT.ROUTING_KEY.PROJECT_DRAFT_CREATED]: ConsumerService.processProjectCreated,
  [EVENT.ROUTING_KEY.PROJECT_UPDATED]: ConsumerService.processProjectUpdated,
};

function close() {
  console.log('closing self after processing messages...');
  try {
    setTimeout(connection.close.bind(connection), 30000);
  } catch (ignore) { // eslint-ignore-line
    logger.logFullError(ignore);
  }
}

export function initHandlers(handlers) {
  EVENT_HANDLERS = handlers;
}

/**
 * Processes the given message
 * @param {Object} msg the message to be processed
 */
function processMessage(msg) {
  return new Promise((resolve, reject) => {
    if (!msg) {
      reject(new Error('Empty message. Ignoring'));
      // return;
    }
    debug(`Consuming message in \n${msg.content}`);
    const key = _.get(msg, 'fields.routingKey');
    debug('Received Message', key, msg.fields);

    let handler;
    let data;
    try {
      handler = EVENT_HANDLERS[key];
      if (!_.isFunction(handler)) {
        logger.error(`Unknown message type: ${key}, NACKing... `);
        reject(new Error(`Unknown message type: ${key}`));
        // return;
      }
      data = JSON.parse(msg.content.toString());
    } catch (ignore) {
      logger.verbose(ignore);
      logger.error('Invalid message. Ignoring');
      resolve('Invalid message. Ignoring');
      // return;
    }
    return handler(logger, data).then(() => resolve(msg))
    .catch((e) => {
      // logger.logFullError(e, `Error processing message`);
      if (e.shouldAck) {
        debug('Resolving for Unprocessable Error in handler...');
        resolve(msg);
      } else {
        debug('Rejecting promise for error in msg processing...');
        reject(new Error('Error processing message'));
      }
    });
  });
}

function assertExchangeQueues(channel, exchangeName, queue) {
  channel.assertExchange(exchangeName, 'topic', { durable: true });
  channel.assertQueue(queue, { durable: true });
  const bindings = _.keys(EVENT_HANDLERS);
  const bindingPromises = _.map(bindings, rk =>
    channel.bindQueue(queue, exchangeName, rk));
  debug(`binding queue ${queue} to exchange: ${exchangeName}`);
  return Promise.all(bindingPromises);
}

export function consumeFailedMessage(connect2sfChannel, msg, counter) {
  if (msg) {
    return processMessage(
      msg
    ).then((responses) => {
      console.log(responses);
      counter++;
      debug('Processed message');
      connect2sfChannel.ack(msg);
      if (counter >= FETCH_LIMIT) {
        close();
      }
    }).catch((e) => {
      counter++;
      debug('Processed message with Error');
      connect2sfChannel.nack(msg);
      logger.logFullError(e, 'Unable to process one of the messages');
      if (counter >= FETCH_LIMIT) {
        close();
      }
    });
  }
  counter++;
  debug('Processed Empty message');
  if (counter >= FETCH_LIMIT) {
    close();
  }
  return Promise.resolve('Processed Empty message');
}

/**
 * Start the worker
 */
export async function scheduleStart() {
  try {
    console.log(`Scheduled Worker Connecting to RabbitMQ: ${config.rabbitmqURL.substr(-5)}`);
    scheduledConnection = await amqp.connect(config.rabbitmqURL);
    scheduledConnection.on('error', (e) => {
      logger.logFullError(e, 'ERROR IN CONNECTION');
    });
    scheduledConnection.on('close', () => {
      debug('Before closing connection...');
    });
    debug(`created connection successfully with URL: ${config.rabbitmqURL}`);
    const connect2sfChannel = await scheduledConnection.createConfirmChannel();
    debug('Channel created for consuming failed messages ...');
    connect2sfChannel.prefetch(FETCH_LIMIT);
    assertExchangeQueues(
      connect2sfChannel,
      config.rabbitmq.connect2sfExchange,
      config.rabbitmq.queues.connect2sf
    ).then(() => {
      debug('Asserted all required exchanges and queues');
      const counter = 0;
      _.range(1, 11).forEach(() => connect2sfChannel.get(config.rabbitmq.queues.connect2sf)
        .then((msg) => consumeFailedMessage(connect2sfChannel, msg, counter)).catch(() => {
          console.log('get failed to consume');
        }));
      scheduledConnection.close();
    });
  } catch (e) {
    logger.logFullError(e, 'Unable to connect to RabbitMQ');
  }
}


/**
 * Consume messages from the queue
 * @param {Object} channel the target channel
 * @param {String} exchangeName the exchange name
 * @param {String} queue the queue name
 */
export async function consume(channel, exchangeName, queue, publishChannel) {
  channel.assertExchange(exchangeName, 'topic', { durable: true });
  publishChannel.assertExchange(exchangeName, 'topic', { durable: true });
  channel.assertQueue(queue, { durable: true });
  const bindings = _.keys(EVENT_HANDLERS);
  const bindingPromises = _.map(bindings, rk =>
    channel.bindQueue(queue, exchangeName, rk));
  return Promise.all(bindingPromises).then(() => {
    channel.consume(queue, async (msg) => {
      if (!msg) {
        return;
      }
      debug(`Consuming message in ${queue}\n${msg.content}`);
      const key = _.get(msg, 'fields.routingKey');
      debug('Received Message', key, msg.fields);

      let handler;
      let data;
      try {
        handler = EVENT_HANDLERS[key];
        if (!_.isFunction(handler)) {
          logger.error(`Unknown message type: ${key}, NACKing... `);
          channel.nack(msg, false, false);
        }
        data = JSON.parse(msg.content.toString());
      } catch (ignore) {
        logger.verbose(ignore);
        logger.error('Invalid message. Ignoring');
        channel.ack(msg);
        return;
      }
      try {
        await handler(logger, data);
        channel.ack(msg);
      } catch (e) {
        logger.logFullError(e, `Queue ${queue}`);
        if (e.shouldAck) {
          channel.ack(msg);
        } else {
          // ack the message but copy it to other queue where no consumer is listening
          // we can listen to that queue on adhoc basis when we see error case like lead not created in SF
          // we can use cloudamqp console to check the messages and may be manually create SF lead
          // nacking here was causing flood of messages to the worker and it keep on consuming high resources
          channel.ack(msg);
          try {
            publishChannel.publish(
              config.rabbitmq.connect2sfExchange,
              // key + EVENT.ROUTING_KEY.FAILED_SUFFIX,
              key,
              new Buffer(msg.content.toString())
            );
          } catch (e1) {
            // TODO decide if we want nack the original msg here
            // for now just ignoring the error in requeue
            logger.logFullError(e1, `Error in publising Exchange to ${exchangeName}`);
          }
        }
      }
    });
  });
}

/**
 * Start the worker
 */
async function startWorker() {
  try {
    console.log(`Worker Connecting to RabbitMQ: ${config.rabbitmqURL.substr(-5)}`);
    connection = await amqp.connect(config.rabbitmqURL);
    debug(`created connection successfully with URL: ${config.rabbitmqURL}`);
    const channel = await connection.createConfirmChannel();
    debug('Channel created for projects exchange ...');
    const publishChannel = await connection.createConfirmChannel();
    debug('Channel created for publishing failed messages ...');
    consume(
      channel,
      config.rabbitmq.projectsExchange,
      config.rabbitmq.queues.project,
      publishChannel
    );
  } catch (e) {
    debug('Unable to connect to RabbitMQ');
  }
}

function start() {
  // regular event consumer
  startWorker();
  // failed event consumers
  cron.schedule(config.scheduledWorkerSchedule, () => {
    scheduleStart();
  });
}

if (!module.parent) {
  start();
}
