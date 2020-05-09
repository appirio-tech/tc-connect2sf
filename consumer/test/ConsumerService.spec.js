/**
 * Unit tests for ConsumerService
 */

import ConsumerService from '../src/services/ConsumerService';
import SalesforceService from '../src/services/SalesforceService';
import IdentityService from '../src/services/IdentityService';
import logger from '../src/common/logger';
import './setup';

describe('ConsumerService', () => {
  const leadId = 'fake-lead-id';
  const user = {
    firstName: 'john',
    lastName: 'doe',
    email: 'jd@example.com',
    handle: 'jdoe',
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
        deadline: '1-2-months',
      },
      utm: {
        code: '123',
        google: {
          _gacid: '1234.5678',
          _gclid: '5678.1234',
        },
      },
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
    createdBy: userId,
  };
  const projectUpdatePaylod = {
    original: {
      id: 1,
      status: 'in_review',
    },
    updated: {
      id: 1,
      status: 'active',
      cancelReason: null,
    },
  };
  let sandbox;
  let getUserStub;
  let authenticateStub;

  // mock all external services
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
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
        Json__c: JSON.stringify({
          ...project,
          createdByEmail: user.email,
          createdByFirstName: user.firstName,
          createdByLastName: user.lastName,
        }),
      };

      const createObjectStub = sandbox.stub(SalesforceService, 'createObject', async() => leadId);

      await ConsumerService.processProjectCreated(logger, project);
      getUserStub.should.have.been.calledWith(userId);
      authenticateStub.should.have.been.called;
      createObjectStub.should.have.been.calledWith(
        'Connect_Event__c', expectedLead, sfAuth.accessToken, sfAuth.instanceUrl);
    });

    it('should NOT throw any error even if primary customer is not found', async() => {
      const projectWihoutMembers = {
        ...project,
        members: [],
      };
      const expectedLead = {
        Type__c: 'connect.project.created',
        Json__c: JSON.stringify({
          ...projectWihoutMembers,
          createdByEmail: user.email,
          createdByFirstName: user.firstName,
          createdByLastName: user.lastName,
        }),
      };

      const createObjectStub = sandbox.stub(SalesforceService, 'createObject', async() => leadId);

      await ConsumerService.processProjectCreated(logger, projectWihoutMembers);
      getUserStub.should.have.been.calledWith(userId);
      authenticateStub.should.have.been.called;
      createObjectStub.should.have.been.calledWith(
        'Connect_Event__c', expectedLead, sfAuth.accessToken, sfAuth.instanceUrl);
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
      const expectedLead = {
        Type__c: 'connect.project.updated',
        Json__c: JSON.stringify({
          original: {
            ...projectUpdatePaylod.original,
            createdByEmail: user.email,
            createdByFirstName: user.firstName,
            createdByLastName: user.lastName,
          },
          updated: projectUpdatePaylod.updated,
        }),
      };
      const createObjectStub = sandbox.stub(SalesforceService, 'createObject', async() => {});

      await ConsumerService.processProjectUpdated(logger, projectUpdatePaylod);
      createObjectStub.should.have.been.calledWith(
        'Connect_Event__c', expectedLead, sfAuth.accessToken, sfAuth.instanceUrl);
    });
  });
});
