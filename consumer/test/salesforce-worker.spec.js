/**
 * Unit tests for worker
 */
import { consumeMessage } from '../src/salesforce-worker';
import ProjectService from '../src/services/ProjectService';
import './setup';

describe('salesforce-worker', () => {
  const sampleSalesforceEvent = {
    payload: {
      Type__c: 'billingAccount.update',
      Original__c: '{ "TC_Connect_Project_ID__c": 1234, "Active__c" : false }',
      Updated__c: '{ "TC_Connect_Project_ID__c": 1234, "Active__c" : true }',
    },
  };
  describe('consumeMessage', () => {
    let updateProjectSpy;
    beforeEach(() => {
      updateProjectSpy = ProjectService.updateProject = sinon.spy();
    });

    /**
     * Invoke the worker consume method using current parameters
     * @param done the mocha done function
     */
    function invokeConsume(done) { // eslint-disable-line
      return consumeMessage(sampleSalesforceEvent);
    }

    it('should consume and active project successfully', (done) => {
      invokeConsume(done);
      updateProjectSpy.should.have.been.calledWith(1234);
      done();
    });
  });
});
