/**
 * Unit tests for SalesforceService
 */

import nock from 'nock';
import config from 'config';
import jwt from 'jsonwebtoken';
import SalesforceService from '../src/services/SalesforceService';
import './setup';

const authenticateResponse = {
  access_token: 'fake_access_token',
  scope: 'api',
  instance_url: 'https://eu6.salesforce.com',
  id: 'https://login.salesforce.com/id/11D58000000t47DEAQ/11558000001OPh4AAG',
  token_type: 'Bearer',
};


describe('SalesforceService', () => {
  const accessToken = 'fake-token';
  const instanceUrl = 'https://fake-instance.com';
  const httpParams = {
    reqheaders: {
      authorization: `Bearer ${accessToken}`,
    },
  };
  const jwtSignSpy = sinon.stub(jwt, 'sign', () => ('fake token'));

  afterEach(() => {
    nock.cleanAll();
  });

  describe('authenticate', () => {
    it('should return a token successfully', async() => {
      const fakeHttp = nock(config.salesforce.audience)
        .post('/services/oauth2/token')
        .reply(200, authenticateResponse);
      const result = await SalesforceService.authenticate();
      jwtSignSpy.should.have.been.calledOnce;
      expect(result).to.deep.equal({
        accessToken: authenticateResponse.access_token,
        instanceUrl: authenticateResponse.instance_url,
      });
      fakeHttp.done();
    });
  });

  describe('createObject', () => {
    it('should return create an object successfully', async() => {
      const type = 'Lead';
      const params = { foo: 'bar' };
      const fakeHttp = nock(instanceUrl, httpParams)
        .post(`/services/data/v37.0/sobjects/${type}`, params)
        .reply(200, {
          id: 'fake-id',
        });
      const id = await SalesforceService.createObject(type, params, accessToken, instanceUrl);
      expect(id).to.equal('fake-id');
      fakeHttp.done();
    });
  });

  describe('query', () => {
    it('should query successfully', async() => {
      const sql = 'SELECT id from Lead where Connect_Project_Id__c = "111"';
      const expected = {
        totalSize: 1,
        done: true,
        records: [
          {
            attributes: {
              type: 'Lead',
              url: '/services/data/v37.0/sobjects/Lead/00Q58000003tLaZEAU',
            },
            Id: '00Q58000003tLaZEAU',
          },
        ],
      };
      const fakeHttp = nock(instanceUrl, httpParams)
        .get('/services/data/v37.0/query')
        .query({q: sql})
        .reply(200, expected);
      const actual = await SalesforceService.query(sql, accessToken, instanceUrl);
      expect(actual).to.deep.equal(expected);
      fakeHttp.done();
    });
  });

  describe('deleteObject', () => {
    it('should delete an object successfully', async() => {
      const type = 'Leader';
      const id = '00Q58000003tLaZEAU';
      const fakeHttp = nock(instanceUrl, httpParams)
        .delete(`/services/data/v37.0/sobjects/${type}/${id}`)
        .reply(204);
      await SalesforceService.deleteObject(type, id, accessToken, instanceUrl);
      fakeHttp.done();
    });
  });
});
