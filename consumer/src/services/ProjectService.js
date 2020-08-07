/**
 * Service to get data from TopCoder API
 */
/* global M2m */
const request = require('superagent');
const config = require('config');
const _ = require('lodash');

const debug = require('debug')('app:project-service');

/**
 * Get project details
 *
 * @param  {String} projectId project id
 *
 * @return {Promise}          promise resolved to project details
 */
const getProject = (projectId) => {
  debug(`AUTH0_CLIENT_ID: ${config.AUTH0_CLIENT_ID.substring(0, 5)}`);
  debug(`AUTH0_CLIENT_SECRET: ${config.AUTH0_CLIENT_SECRET.substring(0, 5)}`);
  return M2m.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
    .then((token) => (
      request
        .get(`${config.projectApi.url}/projects/${projectId}`)
        .set('accept', 'application/json')
        .set('authorization', `Bearer ${token}`)
        .then((res) => {
          if (res.status !== 200) {
            throw new Error(`Failed to get project details of project id: ${projectId}`);
          }
          const project = _.get(res, 'body');
          return project;
        })
        .catch((err) => {
          const errorDetails = _.get(err, 'response.body');
          throw new Error(
            `Failed to get project details of project id: ${projectId}.${
            errorDetails ? ` Server response: ${errorDetails}` : ''}`
          );
        })
    ))
    .catch((err) => {
      err.message = `Error generating m2m token: ${err.message}`;
      throw err;
    });
};

/**
 * Activates the given project
 *
 * @param  {String} projectId project id
 *
 * @return {Promise}          promise resolved to the updated project
 */
const updateProject = (projectId, delta) => {
  debug(`AUTH0_CLIENT_ID: ${config.AUTH0_CLIENT_ID.substring(0, 5)}`);
  debug(`AUTH0_CLIENT_SECRET: ${config.AUTH0_CLIENT_SECRET.substring(0, 5)}`);
  return M2m.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
    .then((token) => (
      request
        .patch(`${config.projectApi.url}/projects/${projectId}`)
        .set('accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(delta)
        .then((res) => {
          if (res.status !== 200) {
            throw new Error(`Failed to update project with id: ${projectId}`);
          }
          const project = _.get(res, 'body');
          if (project) {
            debug(`Successfully updated the project ${projectId} with delta ${JSON.stringify(delta)}`);
          }
          return project;
        })
        .catch((err) => {
          debug(err);
          const errorDetails = _.get(err, 'response.body');
          throw new Error(
            `Failed to update project with id: ${projectId}.${
            errorDetails ? ` Server response: ${errorDetails}` : ''}`
          );
        })
    ))
    .catch((err) => {
      err.message = `Error generating m2m token: ${err.message}`;
      throw err;
    });
};

module.exports = {
  getProject,
  updateProject,
};
