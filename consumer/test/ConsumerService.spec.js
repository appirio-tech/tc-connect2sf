/**
 * Unit tests for ConsumerService
 */

import _ from 'lodash';
import ConsumerService from '../src/services/ConsumerService';
import ConfigurationService from '../src/services/ConfigurationService';
import SalesforceService from '../src/services/SalesforceService';
import IdentityService from '../src/services/IdentityService';
import {UnprocessableError} from '../src/common/errors';
import logger from '../src/common/logger';
import './setup';

describe('ConsumerService', () => {
  const sfCampaignId = 'sf-camp-id';
  const leadId = 'fake-lead-id';
  const user = {
    firstName: 'john',
    lastName: 'doe',
    email: 'jd@example.com',
    handle: 'jdoe'
  };
  const sfAuth = {
    accessToken: 'fake-token',
    instanceUrl: 'http://fake-domain',
  };
  const userId = 40135978;

  const project = {
    id: 1,
    details: {
        appDefinition: {
          budget: 10000,
          budgetType: 'guess',
          whenToStart: 'asap',
          deadline: '1-2-months'
        },
        utm: {
            code: "123",
            google: {
              _gacid: "1234.5678",
              _gclid: "5678.1234"
            }
        }
    },
    cancelReason: null,
    members: [
      {
        id: 1234,
        userId,
        role: 'customer',
        isPrimary: true,
      },
    ],
  };
  const projectUpdatePaylod = {
    original: {
      id: 1,
      status: 'in_review'
    },
    updated: {
      id: 1,
      status: 'active',
      cancelReason: null
    }
  }
  let sandbox;
  let getUserStub;
  let getCampaignIdStub;
  let authenticateStub;

  // mock all external services
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    getCampaignIdStub = sandbox.stub(ConfigurationService, 'getSalesforceCampaignId', async() => sfCampaignId);
    getUserStub = sandbox.stub(IdentityService, 'getUser', async() => user);
    authenticateStub = sandbox.stub(SalesforceService, 'authenticate', async() => sfAuth);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('processProjectCreated', () => {
    it('should process project successfully', async() => {
      const expectedLead = {
        Type__c: 'connect.project.created',
        Json__c: JSON.stringify(project)
      };

      const createObjectStub = sandbox.stub(SalesforceService, 'createObject', async() => leadId);

      await ConsumerService.processProjectCreated(logger, project);
      getCampaignIdStub.should.have.been.called;
      getUserStub.should.have.been.calledWith(userId);
      authenticateStub.should.have.been.called;
      createObjectStub.should.have.been.calledWith('Connect_Event__c', expectedLead, sfAuth.accessToken, sfAuth.instanceUrl);
    });

    it('should throw UnprocessableError primary customer is not found', async() => {
      const projectWihoutMembers = {
        id: 1,
        members: [],
      };
      try {
        ConsumerService.processProjectCreated(logger, projectWihoutMembers);
        sinon.fail('Should be rejected');
      } catch(err) {
        expect(err).to.exist
          .and.be.instanceof(UnprocessableError)
          .and.have.property('message').and.match(/Cannot find primary customer/);
      }
    });

    it('should rethrow Error from createObject if error is not duplicate', async() => {
      const queryStub = sandbox.stub(SalesforceService, 'query');
      queryStub.onCall(0)
        .returns(Promise.resolve({ records: [] }));
      const createObjectStub = sandbox.stub(SalesforceService, 'createObject', async() => {
        throw new Error('Fake Error');
      });
      await expect(ConsumerService.processProjectCreated(logger, project))
        .to.be.rejectedWith(Error, /Fake Error/);
      createObjectStub.should.have.been.called;
    });
  });

  describe('processProjectUpdated', () => {
    it('should process project successfully', async() => {
      const memberId = 'member-id';
      const mergedProject = _.assign({}, projectUpdatePaylod.original, projectUpdatePaylod.updated);
      const expectedLead = {
        Type__c: 'connect.project.updated',
        Json__c: JSON.stringify({ ...projectUpdatePaylod, mergedProject })
      };
      const createObjectStub = sandbox.stub(SalesforceService,'createObject', async() => {});

      await ConsumerService.processProjectUpdated(logger, projectUpdatePaylod);
      createObjectStub.should.have.been.calledWith('Connect_Event__c', expectedLead, sfAuth.accessToken, sfAuth.instanceUrl);
    });
  });
});
