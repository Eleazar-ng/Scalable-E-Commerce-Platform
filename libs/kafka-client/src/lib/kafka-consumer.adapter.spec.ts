import { randomUUID } from 'crypto';
import { GracefulShutdownService } from '@ecommerce-platform/common';
import { createEventEnvelope, EventType } from '@ecommerce-platform/contracts';
import { KafkaConsumerAdapter } from './kafka-consumer.adapter';

function buildShutdownServiceMock(): jest.Mocked<GracefulShutdownService> {
  return { registerHook: jest.fn() } as unknown as jest.Mocked<GracefulShutdownService>;
}

function buildConsumerMock() {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    subscribe: jest.fn(),
    run: jest.fn(),
  };
}

describe('KafkaConsumerAdapter', () => {
  const optionsWithGroup = {
    clientId: 'test-service',
    brokers: ['localhost:9092'],
    consumerGroupId: 'test-service-group',
  };

  it('throws if subscribe is called without a consumerGroupId configured', async () => {
    const kafka = { consumer: jest.fn() } as any;
    const adapter = new KafkaConsumerAdapter(
      kafka,
      { clientId: 'x', brokers: [] },
      buildShutdownServiceMock()
    );

    await expect(adapter.subscribe('order-events', jest.fn())).rejects.toThrow(
      /consumerGroupId is required/
    );
  });

  it('connects lazily - only on first subscribe call, not on module init', async () => {
    const consumerMock = buildConsumerMock();
    const kafka = { consumer: jest.fn(() => consumerMock) } as any;
    const adapter = new KafkaConsumerAdapter(kafka, optionsWithGroup, buildShutdownServiceMock());

    await adapter.onModuleInit();
    expect(kafka.consumer).not.toHaveBeenCalled();

    await adapter.subscribe('order-events', jest.fn());
    expect(kafka.consumer).toHaveBeenCalledTimes(1);
    expect(consumerMock.connect).toHaveBeenCalledTimes(1);
    expect(consumerMock.run).toHaveBeenCalledTimes(1);
  });

  it('reuses the same underlying consumer across multiple subscribe calls', async () => {
    const consumerMock = buildConsumerMock();
    const kafka = { consumer: jest.fn(() => consumerMock) } as any;
    const adapter = new KafkaConsumerAdapter(kafka, optionsWithGroup, buildShutdownServiceMock());

    await adapter.subscribe('order-events', jest.fn());
    await adapter.subscribe('payment-events', jest.fn());

    expect(kafka.consumer).toHaveBeenCalledTimes(1);
    expect(consumerMock.run).toHaveBeenCalledTimes(1); // run() only started once
    expect(consumerMock.subscribe).toHaveBeenCalledTimes(2); // subscribed to both topics
  });

  it('validates and dispatches a well-formed message to the registered handler', async () => {
    const consumerMock = buildConsumerMock();
    const kafka = { consumer: jest.fn(() => consumerMock) } as any;
    const adapter = new KafkaConsumerAdapter(kafka, optionsWithGroup, buildShutdownServiceMock());

    const handler = jest.fn();
    await adapter.subscribe('order-events', handler);

    const eachMessage = consumerMock.run.mock.calls[0][0].eachMessage;
    const orderId = randomUUID();
    const envelope = createEventEnvelope({
      eventType: EventType.ORDER_CREATED,
      aggregateType: 'Order',
      aggregateId: orderId,
      correlationId: randomUUID(),
      payload: {
        orderId,
        customerId: randomUUID(),
        items: [{ productId: randomUUID(), quantity: 1, unitPriceCents: 100 }],
        totalAmountCents: 100,
        currency: 'USD',
      },
    });

    await eachMessage({
      topic: 'order-events',
      partition: 0,
      message: { value: Buffer.from(JSON.stringify(envelope)) },
    });

    expect(handler).toHaveBeenCalledWith(envelope);
  });

  it('does not throw and skips the handler on a malformed message', async () => {
    const consumerMock = buildConsumerMock();
    const kafka = { consumer: jest.fn(() => consumerMock) } as any;
    const adapter = new KafkaConsumerAdapter(kafka, optionsWithGroup, buildShutdownServiceMock());

    const handler = jest.fn();
    await adapter.subscribe('order-events', handler);
    const eachMessage = consumerMock.run.mock.calls[0][0].eachMessage;

    await expect(
      eachMessage({
        topic: 'order-events',
        partition: 0,
        message: { value: Buffer.from('not json at all') },
      })
    ).resolves.not.toThrow();

    expect(handler).not.toHaveBeenCalled();
  });

  it('registers a shutdown hook on first connect', async () => {
    const consumerMock = buildConsumerMock();
    const kafka = { consumer: jest.fn(() => consumerMock) } as any;
    const shutdown = buildShutdownServiceMock();
    const adapter = new KafkaConsumerAdapter(kafka, optionsWithGroup, shutdown);

    await adapter.subscribe('order-events', jest.fn());

    expect(shutdown.registerHook).toHaveBeenCalledWith('kafka-consumer', expect.any(Function));
  });
});
