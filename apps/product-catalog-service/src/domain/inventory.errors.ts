import { ConflictException, DomainException, ValidationException } from '@ecommerce-platform/common';

export class InvalidQuantityException extends ValidationException {
  constructor(quantity: number) {
    super('Quantity must be a positive integer', { quantity });
  }
}

export class InsufficientStockException extends DomainException {
  constructor(productId: string, requested: number, available: number) {
    super('Insufficient stock for this product', { productId, requested, available });
  }
}

export class InsufficientReservedStockException extends DomainException {
  constructor(productId: string, requested: number, reserved: number) {
    super('Cannot release more stock than is currently reserved', {
      productId,
      requested,
      reserved,
    });
  }
}

/**
 * Thrown by the repository layer (Stage 3.2) when Prisma's optimistic
 * concurrency check (WHERE id = ? AND version = ?) matches zero rows -
 * another request modified this Inventory row between read and write.
 * Declared here (domain layer) rather than in infrastructure because it's
 * a domain-meaningful concept (the same pattern this project already uses
 * for Prisma's P2002 -> ConflictException translation in User Service).
 */
export class InventoryConcurrencyConflictException extends ConflictException {
  constructor(productId: string) {
    super('Inventory was modified concurrently - retry the operation', { productId });
  }
}
