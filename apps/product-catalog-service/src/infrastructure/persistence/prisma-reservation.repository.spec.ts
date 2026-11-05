import { Reservation } from '../../domain/reservation.aggregate';
import { ReservationLine } from '../../domain/value-objects/reservation-line.vo';
import { Inventory } from '../../domain/inventory.aggregate';
import { InventoryConcurrencyConflictException } from '../../domain/inventory.errors';
import { PrismaReservationRepository } from './prisma-reservation.repository';

function buildReservation(): Reservation {
  return Reservation.create({
    orderId: 'order-1',
    lines: [ReservationLine.create('product-1', 2), ReservationLine.create('product-2', 1)],
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
}

function buildInventories(): Inventory[] {
  const invA = Inventory.create('product-1', 100);
  invA.reserve(2);
  const invB = Inventory.create('product-2', 50);
  invB.reserve(1);
  return [invA, invB];
}

function buildOutboxEvents() {
  return [
    {
      aggregateType: 'Reservation',
      aggregateId: 'res-1',
      eventType: 'InventoryReserved',
      correlationId: 'corr-1',
      payload: {},
    },
  ];
}

function buildTxMock() {
  return {
    inventory: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    reservation: { create: jest.fn(), update: jest.fn() },
    reservationLine: { createMany: jest.fn() },
    outbox: { create: jest.fn() },
  };
}

function buildPrismaMock(txMock: ReturnType<typeof buildTxMock>) {
  return {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(txMock)),
    reservation: { findUnique: jest.fn(), findFirst: jest.fn() },
  };
}

describe('PrismaReservationRepository.createReservationWithInventoryUpdates', () => {
  it('updates every inventory, creates the reservation + lines, and writes outbox events, all inside one transaction', async () => {
    const tx = buildTxMock();
    const prisma = buildPrismaMock(tx);
    const repo = new PrismaReservationRepository(prisma as any);
    const reservation = buildReservation();

    await repo.createReservationWithInventoryUpdates({
      reservation,
      updatedInventories: buildInventories(),
      outboxEvents: buildOutboxEvents(),
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.reservation.create).toHaveBeenCalledTimes(1);
    expect(tx.reservationLine.createMany).toHaveBeenCalledWith({
      data: [
        { reservationId: reservation.id, productId: 'product-1', quantity: 2 },
        { reservationId: reservation.id, productId: 'product-2', quantity: 1 },
      ],
    });
    expect(tx.outbox.create).toHaveBeenCalledTimes(1);
  });

  it('aborts (throws) on the first inventory concurrency conflict without creating the reservation', async () => {
    const tx = buildTxMock();
    tx.inventory.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 }); // second inventory update conflicts
    const prisma = buildPrismaMock(tx);
    const repo = new PrismaReservationRepository(prisma as any);

    await expect(
      repo.createReservationWithInventoryUpdates({
        reservation: buildReservation(),
        updatedInventories: buildInventories(),
        outboxEvents: buildOutboxEvents(),
      })
    ).rejects.toBeInstanceOf(InventoryConcurrencyConflictException);

    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  it('wraps an unexpected error in ExternalServiceException', async () => {
    const tx = buildTxMock();
    tx.reservation.create.mockRejectedValue(new Error('db connection lost'));
    const prisma = buildPrismaMock(tx);
    const repo = new PrismaReservationRepository(prisma as any);

    await expect(
      repo.createReservationWithInventoryUpdates({
        reservation: buildReservation(),
        updatedInventories: buildInventories(),
        outboxEvents: buildOutboxEvents(),
      })
    ).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
  });
});

describe('PrismaReservationRepository.releaseReservationWithInventoryUpdates', () => {
  it('updates inventories, updates the reservation status, and writes outbox events', async () => {
    const tx = buildTxMock();
    const prisma = buildPrismaMock(tx);
    const repo = new PrismaReservationRepository(prisma as any);
    const reservation = buildReservation();
    reservation.pullDomainEvents();
    reservation.release();

    await repo.releaseReservationWithInventoryUpdates({
      reservation,
      updatedInventories: buildInventories(),
      outboxEvents: buildOutboxEvents(),
    });

    expect(tx.reservation.update).toHaveBeenCalledWith({
      where: { id: reservation.id },
      data: { status: 'RELEASED', updatedAt: expect.any(Date) },
    });
    expect(tx.outbox.create).toHaveBeenCalledTimes(1);
  });

  it('aborts on a concurrency conflict without updating the reservation', async () => {
    const tx = buildTxMock();
    tx.inventory.updateMany.mockResolvedValue({ count: 0 });
    const prisma = buildPrismaMock(tx);
    const repo = new PrismaReservationRepository(prisma as any);
    const reservation = buildReservation();
    reservation.release();

    await expect(
      repo.releaseReservationWithInventoryUpdates({
        reservation,
        updatedInventories: buildInventories(),
        outboxEvents: [],
      })
    ).rejects.toBeInstanceOf(InventoryConcurrencyConflictException);
    expect(tx.reservation.update).not.toHaveBeenCalled();
  });
});

describe('PrismaReservationRepository.findById / findByOrderId', () => {
  it('findById returns null when not found', async () => {
    const tx = buildTxMock();
    const prisma = buildPrismaMock(tx);
    prisma.reservation.findUnique.mockResolvedValue(null);
    const repo = new PrismaReservationRepository(prisma as any);

    expect(await repo.findById('missing')).toBeNull();
  });

  it('findByOrderId maps a found row (with lines) back into a Reservation', async () => {
    const tx = buildTxMock();
    const prisma = buildPrismaMock(tx);
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      orderId: 'order-1',
      status: 'PENDING',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [{ productId: 'product-1', quantity: 2 }],
    });
    const repo = new PrismaReservationRepository(prisma as any);

    const result = await repo.findByOrderId('order-1');
    expect(result?.lines).toHaveLength(1);
  });
});
