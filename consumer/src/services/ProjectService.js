/**
 * Service to get data from TopCoder API
 */
/* global M2m */
const request = require('superagent');
const config = require('config');
const _ = require('lodash');

/**
 * Get project details
 *
 * @param  {String} projectId project id
 *
 * @return {Promise}          promise resolved to project details
 */
const getProject = (projectId) => {
  console.log(`AUTH0_CLIENT_ID: ${config.AUTH0_CLIENT_ID.substring(0, 5)}`);
  console.log(`AUTH0_CLIENT_SECRET: ${config.AUTH0_CLIENT_SECRET.substring(0, 5)}`);
  console.log(`AUTH0_URL: ${config.AUTH0_URL}`);
  console.log(`AUTH0_AUDIENCE: ${config.AUTH0_AUDIENCE}`);
  console.log(`AUTH0_PROXY_SERVER_URL: ${config.AUTH0_PROXY_SERVER_URL}`);
  return M2m.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
    .then((token) => (
      request
        .get(`${config.projectApi.url}/projects/${projectId}`)
        .set('accept', 'application/json')
        .set('authorization', `Bearer ${token}`)
        .then((res) => {
          if (!_.get(res, 'body.result.success')) {
            throw new Error(`Failed to get project details of project id: ${projectId}`);
          }
          const project = _.get(res, 'body.result.content');
          return project;
        }).catch((err) => {
          const errorDetails = _.get(err, 'response.body.result.content.message');
          throw new Error(
            `Failed to get project details of project id: ${projectId}.` +
            (errorDetails ? ' Server response: ' + errorDetails : '')
          );
        })
    ))
    .catch((err) => {
      err.message = 'Error generating m2m token: ' + err.message;
      throw err;
    })
  };

/**
 * Activates the given project
 *
 * @param  {String} projectId project id
 *
 * @return {Promise}          promise resolved to the updated project
 */
const activateProject = (projectId) => (
  M2m.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
    .then((token) => (
      request
        .patch(`${config.projectApi.url}/projects/${projectId}`)
        .set('accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send({ param : { status : 'active' } })
        .then((res) => {
          if (!_.get(res, 'body.result.success')) {
            throw new Error(`Failed to activate project with id: ${projectId}`);
          }
          const project = _.get(res, 'body.result.content');
          if (project) {
            console.log(`Successfully activated the project with id ${projectId}`);
          }
          return project;
        }).catch((err) => {
          console.log(err);
          const errorDetails = _.get(err, 'response.body.result.content.message');
          throw new Error(
            `Failed to update project with id: ${projectId}.` +
            (errorDetails ? ' Server response: ' + errorDetails : '')
          );
        })
    ))
    .catch((err) => {
      err.message = 'Error generating m2m token: ' + err.message;
      throw err;
    })
);

module.exports = {
  getProject,
  activateProject
};