import { Inventory } from '../../domain/inventory.aggregate';
import { InventoryConcurrencyConflictException } from '../../domain/inventory.errors';
import { PrismaInventoryRepository } from './prisma-inventory.repository';
import { InventoryMapper } from './inventory.mapper';

function buildPrismaMock() {
  return {
    inventory: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(),
    },
  };
}

describe('PrismaInventoryRepository', () => {
  it('create() persists the mapped row', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaInventoryRepository(prisma as any);
    const inv = Inventory.create('product-1', 100);

    await repo.create(inv);

    expect(prisma.inventory.create).toHaveBeenCalledWith({ data: InventoryMapper.toPersistence(inv) });
  });

  it('update() writes with WHERE version = (new version - 1), matching the pre-mutation version', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaInventoryRepository(prisma as any);
    const inv = Inventory.create('product-1', 100);
    inv.reserve(10); // bumps version 0 -> 1 in memory

    await repo.update(inv);

    expect(prisma.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: inv.id, version: 0 }, // pre-mutation version
      data: expect.objectContaining({
        availableQuantity: 90,
        reservedQuantity: 10,
        version: 1, // new version being written
      }),
    });
  });

  it('throws InventoryConcurrencyConflictException when the WHERE clause matches zero rows', async () => {
    const prisma = buildPrismaMock();
    prisma.inventory.updateMany.mockResolvedValue({ count: 0 });
    const repo = new PrismaInventoryRepository(prisma as any);
    const inv = Inventory.create('product-1', 100);
    inv.reserve(10);

    await expect(repo.update(inv)).rejects.toBeInstanceOf(InventoryConcurrencyConflictException);
  });

  it('does not throw when exactly one row is updated', async () => {
    const prisma = buildPrismaMock();
    prisma.inventory.updateMany.mockResolvedValue({ count: 1 });
    const repo = new PrismaInventoryRepository(prisma as any);
    const inv = Inventory.create('product-1', 100);
    inv.reserve(10);

    await expect(repo.update(inv)).resolves.not.toThrow();
  });

  it('findByProductId() returns null when not found', async () => {
    const prisma = buildPrismaMock();
    prisma.inventory.findUnique.mockResolvedValue(null);
    const repo = new PrismaInventoryRepository(prisma as any);

    const result = await repo.findByProductId('missing');
    expect(result).toBeNull();
  });

  it('findByProductId() maps a found row back into an Inventory aggregate', async () => {
    const prisma = buildPrismaMock();
    const inv = Inventory.create('product-1', 100);
    const row = InventoryMapper.toPersistence(inv);
    prisma.inventory.findUnique.mockResolvedValue(row);
    const repo = new PrismaInventoryRepository(prisma as any);

    const result = await repo.findByProductId('product-1');
    expect(result?.availableQuantity).toBe(100);
  });
});
