/**
 * Unit tests for worker
 */
import { consumeMessage } from '../src/salesforce-worker';
import ProjectService from '../src/services/ProjectService'
import './setup';

describe('salesforce-worker', () => {
  let sampleSalesforceEvent = {
      Type__c: "billingAccount.updated",
      Json__c: {
        connectProjectId__c: 1234
      }
  }
  describe('consumeMessage', () => {
    let activateProjectSpy;
    beforeEach(() => {
        activateProjectSpy = ProjectService.activateProject = sinon.spy();
    });

    /**
     * Invoke the worker consume method using current parameters
     * @param done the mocha done function
     */
    function invokeConsume(done) {
        return consumeMessage(sampleSalesforceEvent)
    }

    it('should consume and active project successfully', (done) => {
      invokeConsume(done);
      activateProjectSpy.should.have.been.calledWith(1234);
      done();
    });
  });
});
