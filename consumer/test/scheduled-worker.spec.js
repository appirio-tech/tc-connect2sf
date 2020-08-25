/**
 * Unit tests for worker
 */
import './setup';
import {consumeFailedMessage, initHandlers} from '../src/worker';
import {UnprocessableError} from '../src/common/errors';

describe('scheduled-worker', () => {
  describe('consume', () => {
    // const queueName = 'sample-queue';
    const exchangeName = 'sample-exchange';
    const validMessage = {
      content: JSON.stringify({ sampleData: 'foo' }),
      properties: { correlationId: 'unit-tests'},
      fields: { routingKey: exchangeName },
    };
    // let handler;
    let ack;
    let nack;
    let assertQueue;
    let assertExchange;
    let bindQueue;
    // let rabbitGet;
    // const exchangeHandlerSpy = sinon.spy();
    const fakeExchangeHandlerSpy = sinon.spy();
    // const channelPublishSpy = sinon.spy();

    beforeEach(() => {
      // handler = sinon.spy();
      ack = sinon.spy();
      nack = sinon.spy();
      assertQueue = sinon.spy();
      assertExchange = sinon.spy();
      bindQueue = sinon.spy();

      initHandlers({
        [exchangeName]: (logger, data) => new Promise((resolve, reject) => {
          if (data.rejectWithError) {
            reject(new Error());
          } else if (data.rejectWithUnprocessableError) {
            reject(new UnprocessableError());
          } else {
            resolve(data);
          }
        }),
        fakeExchange: fakeExchangeHandlerSpy,
      });
    });

    /**
     * Invoke the worker consume method using current parameters
     * @param done the mocha done function
     */
    function invokeProcessMessages(message, done) { // eslint-disable-line
      return consumeFailedMessage({
        ack,
        nack,
        assertExchange,
        bindQueue,
        assertQueue,
      }, message, 0);
    }

    it('should process and ack a message successfully', () => invokeProcessMessages(validMessage).then(() => {
      ack.should.have.been.calledWith(validMessage);
      nack.should.not.have.been.called;
    }).catch(() => {
      sinon.fail('should not fail');
    }));

    it('should ignore an empty msg', () => invokeProcessMessages(null).then(() => {
      sinon.fail('should not scucced');
    }).catch(() => {
      ack.should.not.have.been.called;
      nack.should.not.have.been.called;
    }));

    it('should ignore an false msg', () => invokeProcessMessages(false).then(() => {
      sinon.fail('should not scucced');
    }).catch(() => {
      ack.should.not.have.been.called;
      nack.should.not.have.been.called;
    }));

    it('should ack a message with invalid JSON', () => {
      const msg = { content: 'foo', fields: { routingKey: exchangeName } };
      return invokeProcessMessages(msg).then(() => {
        sinon.fail('should not scucced');
      }).catch(() => {
        ack.should.have.been.calledWith(msg);
        nack.should.not.have.been.called;
      });
    });

    it('should nack, if error is thrown', () => {
      const msg = {
        content: JSON.stringify({ sampleData: 'foo', rejectWithError: true }),
        properties: { correlationId: 'unit-tests'},
        fields: { routingKey: exchangeName },
      };
      return invokeProcessMessages(msg).then(() => {
        sinon.fail('should not scucced');
      })
      .catch(() => {
        ack.should.not.have.been.calledWith;
        nack.should.have.been.calledWith(msg);
      });
    });

    it('should ack if error is UnprocessableError', () => {
      const msg = {
        content: JSON.stringify({ sampleData: 'foo', rejectWithUnprocessableError: true }),
        properties: { correlationId: 'unit-tests'},
        fields: { routingKey: exchangeName },
      };
      return invokeProcessMessages(msg).then(() => {
        sinon.fail('should not scucced');
      })
      .catch(() => {
        ack.should.have.been.calledWith(msg);
        nack.should.not.have.been.calledWith;
      });
    });
  });
});
