import { kafkaClient } from './kafka-client';

describe('kafkaClient', () => {
  it('should work', () => {
    expect(kafkaClient()).toEqual('kafka-client');
  });
});
