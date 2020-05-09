/**
 * Unit tests for ProjectService
 */

import nock from 'nock';
import config from 'config';
import './setup';
import ProjectService from '../src/services/ProjectService';

const getProjectResponse = {
  id: '265522',
  modifiedBy: null,
  modifiedAt: '2016-06-01T16:57:47.000Z',
  createdBy: null,
  createdAt: '2002-02-06T18:06:40.000Z',
  status: 'active',
  name: 'Test Project',
};


describe('ProjectService', () => {
//   var m2mAuthSpy = ;

  beforeEach(() => {
    global.M2m.getMachineToken = () => Promise.resolve('FAKE');
  });
  afterEach(() => {
    nock.cleanAll();
  });

  describe('authenticate', () => {
    // it('should return token successfully', async() => {
    //   const fakeHttp = nock(config.identityService.url)
    //     .post('/v3/authorizations',
    //     'clientId=' + config.identityService.clientId +
    //     '&secret=' + encodeURIComponent(config.identityService.clientSecret))
    //     .reply(200, authenticateResponse);
    //   const token = await ProjectService.authenticate();
    //   expect(token).to.equal('THEJWTTOKEN');
    //   fakeHttp.done();
    // });
  });

  describe('getProject', () => {
    it('should return a project successfully', async() => {
      const fakeHttp = nock(config.projectApi.url, {
        reqheaders: {
          authorization: 'Bearer faketoken',
        },
      })
        .get('/projects/1234')
        .reply(200, getProjectResponse);
      const project = await ProjectService.getProject(1234);
      expect(project).to.deep.equal(getProjectResponse);
      fakeHttp.done();
    });

    it('should activate a project successfully', async() => {
      const fakeHttp = nock(config.projectApi.url, {
        reqheaders: {
          authorization: 'Bearer faketoken',
        },
      })
        .patch('/projects/1234')
        .reply(200, getProjectResponse);
      const project = await ProjectService.updateProjectStatus(1234);
      console.log(project, 'project');
      expect(project).to.deep.equal(getProjectResponse);
      fakeHttp.done();
    });
  });
});
