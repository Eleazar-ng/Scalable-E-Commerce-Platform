import { randomUUID } from 'crypto';
import { GracefulShutdownService, OutboxRow, OutboxStatus } from '@ecommerce-platform/common';
import { KafkaProducerAdapter } from '@ecommerce-platform/kafka-client';
import { OutboxPublisherService } from './outbox-publisher.service';
import { OutboxStore } from './outbox-store.port';
import { OutboxPublisherOptions } from './outbox-publisher.options';

function buildRow(overrides: Partial<OutboxRow> = {}): OutboxRow {
  const userId = randomUUID();
  return {
    id: 'row-1',
    aggregateType: 'User',
    aggregateId: userId,
    eventType: 'UserRegistered',
    correlationId: randomUUID(),
    payload: { userId, email: 'jane@example.com', firstName: 'Jane' },
    status: OutboxStatus.PUBLISHING,
    createdAt: new Date(),
    publishedAt: null,
    retryCount: 0,
    ...overrides,
  };
}

function buildStoreMock(): jest.Mocked<OutboxStore> {
  return {
    claimBatch: jest.fn().mockResolvedValue([]),
    markPublished: jest.fn(),
    markRetry: jest.fn(),
    markFailed: jest.fn(),
  };
}

function buildKafkaProducerMock(): jest.Mocked<KafkaProducerAdapter> {
  return { publish: jest.fn() } as unknown as jest.Mocked<KafkaProducerAdapter>;
}

function buildOptions(overrides: Partial<OutboxPublisherOptions> = {}): OutboxPublisherOptions {
  return {
    pollIntervalMs: 100000, // long enough that no interval fires during a test
    batchSize: 50,
    maxRetries: 3,
    topicByAggregateType: { User: 'user-events' as any },
    ...overrides,
  };
}

function buildShutdownServiceMock(): jest.Mocked<GracefulShutdownService> {
  return { registerHook: jest.fn() } as unknown as jest.Mocked<GracefulShutdownService>;
}

describe('OutboxPublisherService.poll', () => {
  it('publishes every claimed row and marks each PUBLISHED', async () => {
    const store = buildStoreMock();
    store.claimBatch.mockResolvedValue([buildRow()]);
    const kafka = buildKafkaProducerMock();
    const service = new OutboxPublisherService(store, kafka, buildOptions(), buildShutdownServiceMock());

    await service.poll();

    expect(kafka.publish).toHaveBeenCalledTimes(1);
    expect(kafka.publish).toHaveBeenCalledWith(
      'user-events',
      expect.objectContaining({ eventType: 'UserRegistered' })
    );
    expect(store.markPublished).toHaveBeenCalledWith('row-1');
  });

  it('builds an envelope with a fresh eventId and occurredAt', async () => {
    const store = buildStoreMock();
    store.claimBatch.mockResolvedValue([buildRow()]);
    const kafka = buildKafkaProducerMock();
    const service = new OutboxPublisherService(store, kafka, buildOptions(), buildShutdownServiceMock());

    await service.poll();

    const [, envelope] = kafka.publish.mock.calls[0];
    expect(envelope.eventId).toBeDefined();
    expect(() => new Date(envelope.occurredAt).toISOString()).not.toThrow();
    expect(envelope.version).toBe(1);
  });

  it('marks FAILED (not retried) when no topic is configured for the aggregateType', async () => {
    const store = buildStoreMock();
    store.claimBatch.mockResolvedValue([buildRow({ aggregateType: 'Unmapped' })]);
    const kafka = buildKafkaProducerMock();
    const service = new OutboxPublisherService(store, kafka, buildOptions(), buildShutdownServiceMock());

    await service.poll();

    expect(kafka.publish).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalledWith('row-1');
  });

  it('marks FAILED when the eventType has no registered schema', async () => {
    const store = buildStoreMock();
    store.claimBatch.mockResolvedValue([buildRow({ eventType: 'NotARealEvent' })]);
    const kafka = buildKafkaProducerMock();
    const service = new OutboxPublisherService(store, kafka, buildOptions(), buildShutdownServiceMock());

    await service.poll();

    expect(kafka.publish).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalledWith('row-1');
  });

  it('marks FAILED when the payload does not match its schema', async () => {
    const store = buildStoreMock();
    store.claimBatch.mockResolvedValue([buildRow({ payload: { totally: 'wrong shape' } })]);
    const kafka = buildKafkaProducerMock();
    const service = new OutboxPublisherService(store, kafka, buildOptions(), buildShutdownServiceMock());

    await service.poll();

    expect(kafka.publish).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalledWith('row-1');
  });

  it('marks RETRY (not FAILED) on a publish failure below the retry cap', async () => {
    const store = buildStoreMock();
    store.claimBatch.mockResolvedValue([buildRow({ retryCount: 0 })]);
    const kafka = buildKafkaProducerMock();
    kafka.publish.mockRejectedValue(new Error('broker unreachable'));
    const service = new OutboxPublisherService(store, kafka, buildOptions({ maxRetries: 3 }), buildShutdownServiceMock());

    await service.poll();

    expect(store.markRetry).toHaveBeenCalledWith('row-1');
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it('marks FAILED once retryCount reaches maxRetries', async () => {
    const store = buildStoreMock();
    store.claimBatch.mockResolvedValue([buildRow({ retryCount: 2 })]); // next attempt = 3 = maxRetries
    const kafka = buildKafkaProducerMock();
    kafka.publish.mockRejectedValue(new Error('broker unreachable'));
    const service = new OutboxPublisherService(store, kafka, buildOptions({ maxRetries: 3 }), buildShutdownServiceMock());

    await service.poll();

    expect(store.markFailed).toHaveBeenCalledWith('row-1');
    expect(store.markRetry).not.toHaveBeenCalled();
  });

  it('processes multiple rows in one batch independently', async () => {
    const store = buildStoreMock();
    store.claimBatch.mockResolvedValue([buildRow({ id: 'row-1' }), buildRow({ id: 'row-2' })]);
    const kafka = buildKafkaProducerMock();
    const service = new OutboxPublisherService(store, kafka, buildOptions(), buildShutdownServiceMock());

    await service.poll();

    expect(store.markPublished).toHaveBeenCalledWith('row-1');
    expect(store.markPublished).toHaveBeenCalledWith('row-2');
  });

  it('does not throw when claimBatch itself fails - logs and returns', async () => {
    const store = buildStoreMock();
    store.claimBatch.mockRejectedValue(new Error('db connection lost'));
    const kafka = buildKafkaProducerMock();
    const service = new OutboxPublisherService(store, kafka, buildOptions(), buildShutdownServiceMock());

    await expect(service.poll()).resolves.not.toThrow();
    expect(kafka.publish).not.toHaveBeenCalled();
  });

  it('skips a poll that would overlap a still-running one', async () => {
    const store = buildStoreMock();
    let resolveClaim: (rows: OutboxRow[]) => void;
    store.claimBatch.mockReturnValue(
      new Promise((resolve) => {
        resolveClaim = resolve;
      })
    );
    const kafka = buildKafkaProducerMock();
    const service = new OutboxPublisherService(store, kafka, buildOptions(), buildShutdownServiceMock());

    const firstPoll = service.poll(); // still in-flight (claimBatch not resolved yet)
    await service.poll(); // should return immediately, skipped

    expect(store.claimBatch).toHaveBeenCalledTimes(1);
    resolveClaim!([]);
    await firstPoll;
  });
});

describe('OutboxPublisherService lifecycle', () => {
  it('registers a shutdown hook on module init', () => {
    const store = buildStoreMock();
    const kafka = buildKafkaProducerMock();
    const shutdown = buildShutdownServiceMock();
    const service = new OutboxPublisherService(store, kafka, buildOptions(), shutdown);

    service.onModuleInit();
    service.onModuleDestroy(); // clean up the interval this test started

    expect(shutdown.registerHook).toHaveBeenCalledWith('outbox-publisher-stop', expect.any(Function));
  });
});
