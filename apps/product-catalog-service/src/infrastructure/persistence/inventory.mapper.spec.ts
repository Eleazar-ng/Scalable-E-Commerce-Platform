import { Inventory } from '../../domain/inventory.aggregate';
import { InventoryMapper } from './inventory.mapper';

describe('InventoryMapper', () => {
  it('round-trips through toPersistence -> toDomain, preserving version', () => {
    const original = Inventory.create('product-1', 100);
    original.reserve(10);

    const row = InventoryMapper.toPersistence(original);
    const rehydrated = InventoryMapper.toDomain(row);

    expect(rehydrated.availableQuantity).toBe(90);
    expect(rehydrated.reservedQuantity).toBe(10);
    expect(rehydrated.version).toBe(1);
  });
});
