/**
 * Unit tests for ProjectService
 */

import nock from 'nock';
import config from 'config';
import './setup';
import ProjectService from '../src/services/ProjectService';


const authenticateResponse = {
  id: '-88f3803:1557f8485b0:-ae0',
  result: {
    content: {
      createdAt: null,
      createdBy: null,
      externalToken: null,
      id: '1110840181',
      modifiedAt: null,
      modifiedBy: null,
      refreshToken: null,
      target: '1',
      token: 'THEJWTTOKEN',
      zendeskJwt: null,
    },
    metadata: null,
    status: 200,
    success: true,
  },
  version: 'v3',
};

const getProjectResponse = {
  id: '-88f3803:1557f8485b0:-b0a',
  result: {
    success: true,
    status: 200,
    metadata: null,
    content: {
      id: '265522',
      modifiedBy: null,
      modifiedAt: '2016-06-01T16:57:47.000Z',
      createdBy: null,
      createdAt: '2002-02-06T18:06:40.000Z',
      status: 'active',
      name: 'Test Project',
    },
  },
  version: 'v4',
};


describe('ProjectService', () => {
//   var m2mAuthSpy = ;

  beforeEach(() => {
    M2m.getMachineToken = function() { return Promise.resolve('FAKE'); };
  });
  afterEach(() => {
    nock.cleanAll();
  });

  describe('authenticate', () => {
    // it('should return token successfully', async() => {
    //   const fakeHttp = nock(config.identityService.url)
    //     .post('/v3/authorizations', 'clientId=' + config.identityService.clientId + '&secret=' + encodeURIComponent(config.identityService.clientSecret))
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
      const user = await ProjectService.getProject(1234);
      expect(user).to.deep.equal(getProjectResponse.result.content);
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
      const user = await ProjectService.updateProjectStatus(1234);
      expect(user).to.deep.equal(getProjectResponse.result.content);
      fakeHttp.done();
    });
  });
});
