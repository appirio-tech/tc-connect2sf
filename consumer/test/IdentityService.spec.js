/**
 * Unit tests for IdentityService
 */

import nock from 'nock';
import config from 'config';
import IdentityService from '../src/services/IdentityService';
import './setup';

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

const getUserResponse = {
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
      handle: 'veredox',
      email: 'email@domain.com.z',
      firstName: 'F_NAME',
      lastName: 'L_NAME',
      credential: {
        activationCode: '3DZ9IVH4',
        resetToken: null,
        hasPassword: true,
      },
      status: 'A',
      country: null,
      regSource: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      active: true,
      profile: null,
      emailActive: true,
    },
  },
  version: 'v3',
};


describe('IdentityService', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe('authenticate', () => {
    it('should return token successfully', async() => {
      const fakeHttp = nock(config.identityService.url)
        .post('/v3/authorizations',
        `clientId=${config.identityService.clientId}&secret=${encodeURIComponent(config.identityService.clientSecret)}`)
        .reply(200, authenticateResponse);
      const token = await IdentityService.authenticate();
      expect(token).to.equal('THEJWTTOKEN');
      fakeHttp.done();
    });
  });

  describe('getUser', () => {
    it('should return a user successfully', async() => {
      const fakeHttp = nock(config.identityService.url, {
        reqheaders: {
          authorization: 'Bearer faketoken',
        },
      })
        .get('/v3/users/fakeId')
        .reply(200, getUserResponse);
      const user = await IdentityService.getUser('fakeId', 'faketoken');
      expect(user).to.deep.equal(getUserResponse.result.content);
      fakeHttp.done();
    });
    it('should return a user and authenticate successfully', async() => {
      const fakeAuthHttp = nock(config.identityService.url)
        .post('/v3/authorizations',
        `clientId=${config.identityService.clientId}&secret=${encodeURIComponent(config.identityService.clientSecret)}`)
        .reply(200, authenticateResponse);
      const fakeHttp = nock(config.identityService.url, {
        reqheaders: {
          authorization: 'Bearer THEJWTTOKEN',
        },
      })
        .get('/v3/users/fakeId')
        .reply(200, getUserResponse);
      const user = await IdentityService.getUser('fakeId');
      expect(user).to.deep.equal(getUserResponse.result.content);
      fakeHttp.done();
      fakeAuthHttp.done();
    });
  });
});
