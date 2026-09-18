import { Inventory } from './inventory.aggregate';
import {
  InsufficientReservedStockException,
  InsufficientStockException,
  InvalidQuantityException,
} from './inventory.errors';

describe('Inventory.create', () => {
  it('creates with the given initial quantity, zero reserved, version 0', () => {
    const inv = Inventory.create('product-1', 100);
    expect(inv.availableQuantity).toBe(100);
    expect(inv.reservedQuantity).toBe(0);
    expect(inv.version).toBe(0);
  });

  it('allows zero initial quantity', () => {
    expect(() => Inventory.create('product-1', 0)).not.toThrow();
  });

  it.each([-1, 1.5, NaN])('rejects an invalid initial quantity: %s', (qty) => {
    expect(() => Inventory.create('product-1', qty)).toThrow(InvalidQuantityException);
  });
});

describe('Inventory.reserve', () => {
  it('decrements available and increments reserved', () => {
    const inv = Inventory.create('product-1', 100);
    inv.reserve(10);
    expect(inv.availableQuantity).toBe(90);
    expect(inv.reservedQuantity).toBe(10);
  });

  it('bumps the version on every reservation', () => {
    const inv = Inventory.create('product-1', 100);
    inv.reserve(10);
    expect(inv.version).toBe(1);
    inv.reserve(5);
    expect(inv.version).toBe(2);
  });

  it('throws InsufficientStockException when requesting more than available', () => {
    const inv = Inventory.create('product-1', 5);
    expect(() => inv.reserve(10)).toThrow(InsufficientStockException);
  });

  it('does not mutate state when the reservation fails', () => {
    const inv = Inventory.create('product-1', 5);
    try {
      inv.reserve(10);
    } catch {
      /* expected */
    }
    expect(inv.availableQuantity).toBe(5);
    expect(inv.version).toBe(0);
  });

  it('allows reserving exactly the full available quantity', () => {
    const inv = Inventory.create('product-1', 10);
    inv.reserve(10);
    expect(inv.availableQuantity).toBe(0);
    expect(inv.reservedQuantity).toBe(10);
  });

  it.each([0, -1, 1.5])('rejects an invalid reserve quantity: %s', (qty) => {
    const inv = Inventory.create('product-1', 100);
    expect(() => inv.reserve(qty)).toThrow(InvalidQuantityException);
  });
});

describe('Inventory.release', () => {
  it('restores available and decrements reserved', () => {
    const inv = Inventory.create('product-1', 100);
    inv.reserve(10);
    inv.release(10);
    expect(inv.availableQuantity).toBe(100);
    expect(inv.reservedQuantity).toBe(0);
  });

  it('supports partial release', () => {
    const inv = Inventory.create('product-1', 100);
    inv.reserve(10);
    inv.release(4);
    expect(inv.availableQuantity).toBe(94);
    expect(inv.reservedQuantity).toBe(6);
  });

  it('throws InsufficientReservedStockException when releasing more than reserved', () => {
    const inv = Inventory.create('product-1', 100);
    inv.reserve(5);
    expect(() => inv.release(10)).toThrow(InsufficientReservedStockException);
  });

  it.each([0, -1, 1.5])('rejects an invalid release quantity: %s', (qty) => {
    const inv = Inventory.create('product-1', 100);
    expect(() => inv.release(qty)).toThrow(InvalidQuantityException);
  });
});

describe('Inventory.restock', () => {
  it('adds directly to available quantity', () => {
    const inv = Inventory.create('product-1', 50);
    inv.restock(25);
    expect(inv.availableQuantity).toBe(75);
  });

  it('does not affect reservedQuantity', () => {
    const inv = Inventory.create('product-1', 50);
    inv.reserve(10);
    inv.restock(25);
    expect(inv.reservedQuantity).toBe(10);
    expect(inv.availableQuantity).toBe(65);
  });

  it.each([0, -1])('rejects an invalid restock quantity: %s', (qty) => {
    const inv = Inventory.create('product-1', 50);
    expect(() => inv.restock(qty)).toThrow(InvalidQuantityException);
  });
});

describe('Inventory.reconstitute', () => {
  it('rehydrates from persisted props', () => {
    const now = new Date();
    const inv = Inventory.reconstitute({
      id: 'inv-1',
      productId: 'product-1',
      availableQuantity: 40,
      reservedQuantity: 10,
      version: 3,
      createdAt: now,
      updatedAt: now,
    });

    expect(inv.availableQuantity).toBe(40);
    expect(inv.reservedQuantity).toBe(10);
    expect(inv.version).toBe(3);
  });
});
