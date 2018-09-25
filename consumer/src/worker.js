/**
 * The main app entry
 */

import config from 'config';
import amqp from 'amqplib';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import bodyParser from 'body-parser';
import _ from 'lodash';
import { middleware } from 'tc-core-library-js';
import logger from './common/logger';
import ConsumerService from './services/ConsumerService';
import LeadService from './services/LeadService';
import { EVENT, ERROR } from '../config/constants';
import { start as scheduleStart } from './scheduled-worker';

const debug = require('debug')('app:worker');

let connection;
process.once('SIGINT', () => {
  try {
    connection.close();
  } catch (ignore) { // eslint-ignore-line
  }
  process.exit();
});

let EVENT_HANDLERS = {
  [EVENT.ROUTING_KEY.PROJECT_DRAFT_CREATED]: ConsumerService.processProjectCreated,
  [EVENT.ROUTING_KEY.PROJECT_UPDATED]: ConsumerService.processProjectUpdated,
};

export function initHandlers(handlers) {
  EVENT_HANDLERS = handlers;
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
        logger.info(ignore);
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
          } catch (e) {
            // TODO decide if we want nack the original msg here
            // for now just ignoring the error in requeue
            logger.logFullError(e, `Error in publising Exchange to ${exchangeName}`);
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

/*
 * Error handler for Async functions
 */
const asyncHandler = fn => (req, res, next) => {
  Promise
    .resolve(fn(req, res, next))
    .catch(next);
};

if (!module.parent) {
  startWorker();

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }

  const app = express();

  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true,
  }));

  app.use((req, res, next) => {
    middleware.jwtAuthenticator({
      AUTH_SECRET: config.authSecret,
      VALID_ISSUERS: config.validIssuers,
    })(req, res, next);
  });

  app.post(`${config.apiVersion}/connect2sf/leadInfo`, asyncHandler(async (req, res, next) => {
    const result = await LeadService.postLead(req.body);
    res.json(result);
  }));

  // Error handler
  app.use(async (err, req, res, next) => {
    let status = ERROR.SERVER_ERROR;
    let message = err.message;
    // Fetch actual error message from details for JOI errors
    if (err.isJoi) {
      status = ERROR.CLIENT_ERROR;
      message = err.details[0].message;
    }
    if (!message) {
      message = ERROR.MESSAGE;
    }
    res.status(status).send({ message });
  });

  app.listen(config.port);
  debug(`Express server listening on port ${config.port} in ${process.env.NODE_ENV} mode`);

  cron.schedule(config.scheduledWorkerSchedule, () => {
    scheduleStart();
  });
}
