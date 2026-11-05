import { Inventory } from '../../domain/inventory.aggregate';

export interface InventoryRow {
  id: string;
  productId: string;
  availableQuantity: number;
  reservedQuantity: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class InventoryMapper {
  static toDomain(row: InventoryRow): Inventory {
    return Inventory.reconstitute({
      id: row.id,
      productId: row.productId,
      availableQuantity: row.availableQuantity,
      reservedQuantity: row.reservedQuantity,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistence(inventory: Inventory): InventoryRow {
    const snapshot = inventory.toSnapshot();
    return {
      id: snapshot.id,
      productId: snapshot.productId,
      availableQuantity: snapshot.availableQuantity,
      reservedQuantity: snapshot.reservedQuantity,
      version: snapshot.version,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
  }
}
