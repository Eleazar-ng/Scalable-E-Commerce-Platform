import { PrismaOutboxStore } from './prisma-outbox.store';

function buildTxMock() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn(),
  };
}

function buildPrismaMock(txMock: ReturnType<typeof buildTxMock>) {
  return {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(txMock)),
    outbox: { update: jest.fn() },
  };
}

describe('PrismaOutboxStore.claimBatch', () => {
  it('returns an empty array when no rows are claimed', async () => {
    const tx = buildTxMock();
    const prisma = buildPrismaMock(tx);
    const store = new PrismaOutboxStore(prisma as any);

    const result = await store.claimBatch(50);

    expect(result).toEqual([]);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('marks claimed rows PUBLISHING and maps them to OutboxRow', async () => {
    const tx = buildTxMock();
    const dbRow = {
      id: 'row-1',
      aggregateType: 'Reservation',
      aggregateId: 'res-1',
      eventType: 'InventoryReserved',
      correlationId: 'corr-1',
      payload: { orderId: 'order-1' },
      status: 'PENDING',
      createdAt: new Date(),
      publishedAt: null,
      retryCount: 0,
    };
    tx.$queryRaw.mockResolvedValue([dbRow]);
    const prisma = buildPrismaMock(tx);
    const store = new PrismaOutboxStore(prisma as any);

    const result = await store.claimBatch(50);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'row-1',
      status: 'PUBLISHING',
      aggregateType: 'Reservation',
    });
  });

  it('wraps a transaction failure in ExternalServiceException', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(new Error('db unreachable')),
      outbox: { update: jest.fn() },
    };
    const store = new PrismaOutboxStore(prisma as any);

    await expect(store.claimBatch(50)).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
  });
});

describe('PrismaOutboxStore status transitions', () => {
  it('markPublished sets status PUBLISHED and publishedAt', async () => {
    const tx = buildTxMock();
    const prisma = buildPrismaMock(tx);
    const store = new PrismaOutboxStore(prisma as any);

    await store.markPublished('row-1');

    expect(prisma.outbox.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
    });
  });

  it('markRetry reverts status to PENDING and increments retryCount', async () => {
    const tx = buildTxMock();
    const prisma = buildPrismaMock(tx);
    const store = new PrismaOutboxStore(prisma as any);

    await store.markRetry('row-1');

    expect(prisma.outbox.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { status: 'PENDING', retryCount: { increment: 1 } },
    });
  });

  it('markFailed sets status FAILED', async () => {
    const tx = buildTxMock();
    const prisma = buildPrismaMock(tx);
    const store = new PrismaOutboxStore(prisma as any);

    await store.markFailed('row-1');

    expect(prisma.outbox.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { status: 'FAILED' },
    });
  });
});
