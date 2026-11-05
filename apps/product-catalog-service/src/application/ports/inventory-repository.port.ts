import { Inventory } from '../../domain/inventory.aggregate';

export interface InventoryRepositoryPort {
  create(inventory: Inventory): Promise<void>;
  /**
   * Standalone update (e.g. an admin restock operation) - NOT the path
   * used during a reservation, which instead goes through
   * ReservationRepositoryPort so the Inventory update(s), the Reservation
   * insert, and the outbox event all commit atomically in one transaction.
   *
   * Enforces optimistic concurrency: writes with
   * `WHERE id = ? AND version = (inventory.version - 1)`, since every
   * domain mutation method (reserve/release/restock) bumps `version` by
   * exactly 1 in memory before this is called. A zero-row update means
   * another request modified this row first - throws
   * InventoryConcurrencyConflictException (see inventory.errors.ts).
   */
  update(inventory: Inventory): Promise<void>;
  findByProductId(productId: string): Promise<Inventory | null>;
}

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');
