import { randomUUID } from 'crypto';
import {
  InsufficientReservedStockException,
  InsufficientStockException,
  InvalidQuantityException,
} from './inventory.errors';

export interface InventoryProps {
  id: string;
  productId: string;
  availableQuantity: number;
  reservedQuantity: number;
  /**
   * Optimistic concurrency token. Incremented on every mutation; the
   * repository layer (Stage 3.2) writes with `WHERE id = ? AND version = ?`
   * and treats a zero-row update as a concurrent-modification conflict.
   * Essential here specifically - Inventory is the one aggregate in this
   * service that faces genuine write contention (many simultaneous
   * checkouts touching the same product).
   */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Per-product stock aggregate, deliberately separate from Product (see
 * product.aggregate.ts's header comment). Tracks available vs. reserved
 * quantity using the "optimistic reservation" model (architecture
 * decision: Stage 3.1 planning) - reserve() immediately decrements
 * available stock; nothing further happens to it on order confirmation,
 * only release() (compensation) restores it.
 */
export class Inventory {
  private constructor(private props: InventoryProps) {}

  static create(productId: string, initialQuantity: number): Inventory {
    if (!Number.isInteger(initialQuantity) || initialQuantity < 0) {
      throw new InvalidQuantityException(initialQuantity);
    }

    const now = new Date();
    return new Inventory({
      id: randomUUID(),
      productId,
      availableQuantity: initialQuantity,
      reservedQuantity: 0,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: InventoryProps): Inventory {
    return new Inventory(props);
  }

  reserve(quantity: number): void {
    this.assertValidQuantity(quantity);

    if (this.props.availableQuantity < quantity) {
      throw new InsufficientStockException(
        this.props.productId,
        quantity,
        this.props.availableQuantity
      );
    }

    this.props.availableQuantity -= quantity;
    this.props.reservedQuantity += quantity;
    this.bumpVersion();
  }

  /** Compensating action - restores stock previously taken by reserve(). */
  release(quantity: number): void {
    this.assertValidQuantity(quantity);

    if (this.props.reservedQuantity < quantity) {
      throw new InsufficientReservedStockException(
        this.props.productId,
        quantity,
        this.props.reservedQuantity
      );
    }

    this.props.availableQuantity += quantity;
    this.props.reservedQuantity -= quantity;
    this.bumpVersion();
  }

  /** Admin operation - e.g. a new stock delivery. Adds directly to available. */
  restock(quantity: number): void {
    this.assertValidQuantity(quantity);
    this.props.availableQuantity += quantity;
    this.bumpVersion();
  }

  private assertValidQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InvalidQuantityException(quantity);
    }
  }

  private bumpVersion(): void {
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }

  get productId(): string {
    return this.props.productId;
  }

  get availableQuantity(): number {
    return this.props.availableQuantity;
  }

  get reservedQuantity(): number {
    return this.props.reservedQuantity;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toSnapshot(): InventoryProps {
    return { ...this.props };
  }
}
