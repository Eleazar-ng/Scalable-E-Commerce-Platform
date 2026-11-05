import { Injectable } from '@nestjs/common';
import { ExternalServiceException } from '@ecommerce-platform/common';
import { Inventory } from '../../domain/inventory.aggregate';
import { InventoryConcurrencyConflictException } from '../../domain/inventory.errors';
import { InventoryRepositoryPort } from '../../application/ports/inventory-repository.port';
import { PrismaService } from './prisma.service';
import { InventoryMapper } from './inventory.mapper';

@Injectable()
export class PrismaInventoryRepository implements InventoryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(inventory: Inventory): Promise<void> {
    try {
      await this.prisma.inventory.create({ data: InventoryMapper.toPersistence(inventory) });
    } catch (error) {
      throw new ExternalServiceException('Inventory repository create failed', {
        retryable: true,
        context: { productId: inventory.productId },
        cause: error,
      });
    }
  }

  async update(inventory: Inventory): Promise<void> {
    const row = InventoryMapper.toPersistence(inventory);
    // Every domain mutation (reserve/release/restock) bumps `version` by
    // exactly 1 in memory before this is called - so the version this row
    // was read at is always `row.version - 1`. See InventoryRepositoryPort's
    // doc comment for the full explanation of this convention.
    const previousVersion = row.version - 1;

    let result: { count: number };
    try {
      result = await this.prisma.inventory.updateMany({
        where: { id: row.id, version: previousVersion },
        data: {
          availableQuantity: row.availableQuantity,
          reservedQuantity: row.reservedQuantity,
          version: row.version,
          updatedAt: row.updatedAt,
        },
      });
    } catch (error) {
      throw new ExternalServiceException('Inventory repository update failed', {
        retryable: true,
        context: { productId: inventory.productId },
        cause: error,
      });
    }

    if (result.count === 0) {
      throw new InventoryConcurrencyConflictException(inventory.productId);
    }
  }

  async findByProductId(productId: string): Promise<Inventory | null> {
    const row = await this.prisma.inventory.findUnique({ where: { productId } });
    return row ? InventoryMapper.toDomain(row) : null;
  }
}
