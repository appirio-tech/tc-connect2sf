/**
 * The main app entry
 */

import config from 'config';
import express from 'express';
import faye from 'faye';
import cors from 'cors';
import bodyParser from 'body-parser';
import _ from 'lodash';
import { middleware } from 'tc-core-library-js';
import logger from './common/logger';
import ConsumerService from './services/ConsumerService';
import LeadService from './services/LeadService';
import { EVENT, ERROR } from '../config/constants';
import SalesforceService from './services/SalesforceService';

const debug = require('debug')('app:worker');

// let connection;
process.once('SIGINT', () => {
  try {
    // connection.close();
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

/*
 * Error handler for Async functions
 */
const asyncHandler = fn => (req, res, next) => {
  Promise
    .resolve(fn(req, res, next))
    .catch(next);
};

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

function start() {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true,
  }));
  app.logger = logger;

  console.log(`/${config.apiVersion}/connect2sf/health`)
  app.use((req, res, next) => {
    if (req.url !== `/${config.apiVersion}/connect2sf/health`) {
      middleware.jwtAuthenticator({
        AUTH_SECRET: config.authSecret,
        VALID_ISSUERS: config.validIssuers,
      })(req, res, next);
    } else {
      next();
    }
  });

  app.get(`/${config.apiVersion}/connect2sf/health`, (req, res) => {
    // TODO more checks
    res.status(200).send({
      message: 'All-is-well',
    });
  });

  app.post(`/${config.apiVersion}/connect2sf/leadInfo`, asyncHandler(async (req, res, next) => {
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

}

if (!module.parent) {
  start();
}