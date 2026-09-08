import { randomUUID } from 'crypto';
import { GracefulShutdownService } from '@ecommerce-platform/common';
import { createEventEnvelope, EventType } from '@ecommerce-platform/contracts';
import { KafkaProducerAdapter } from './kafka-producer.adapter';

function buildShutdownServiceMock(): jest.Mocked<GracefulShutdownService> {
  return { registerHook: jest.fn() } as unknown as jest.Mocked<GracefulShutdownService>;
}

describe('KafkaProducerAdapter', () => {
  const options = { clientId: 'test-service', brokers: ['localhost:9092'] };

  it('connects and registers a shutdown hook on module init', async () => {
    const producer = { connect: jest.fn(), disconnect: jest.fn(), send: jest.fn() };
    const kafka = { producer: () => producer } as any;
    const shutdown = buildShutdownServiceMock();

    const adapter = new KafkaProducerAdapter(kafka, options, shutdown);
    await adapter.onModuleInit();

    expect(producer.connect).toHaveBeenCalledTimes(1);
    expect(shutdown.registerHook).toHaveBeenCalledWith('kafka-producer', expect.any(Function));
  });

  it('publishes with the aggregateId as the partition key', async () => {
    const producer = { connect: jest.fn(), disconnect: jest.fn(), send: jest.fn() };
    const kafka = { producer: () => producer } as any;
    const adapter = new KafkaProducerAdapter(kafka, options, buildShutdownServiceMock());
    await adapter.onModuleInit();

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

    await adapter.publish('order-events', envelope);

    expect(producer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'order-events',
        messages: [expect.objectContaining({ key: orderId })],
      })
    );
  });

  it('wraps a send failure in ExternalServiceException', async () => {
    const producer = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn().mockRejectedValue(new Error('broker unreachable')),
    };
    const kafka = { producer: () => producer } as any;
    const adapter = new KafkaProducerAdapter(kafka, options, buildShutdownServiceMock());
    await adapter.onModuleInit();

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

    await expect(adapter.publish('order-events', envelope)).rejects.toMatchObject({
      code: 'EXTERNAL_SERVICE_ERROR',
      retryable: true,
    });
  });
});
