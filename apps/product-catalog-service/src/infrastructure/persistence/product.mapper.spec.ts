import { Product } from '../../domain/product.aggregate';
import { Sku } from '../../domain/value-objects/sku.vo';
import { Money } from '../../domain/value-objects/money.vo';
import { ProductMapper } from './product.mapper';

describe('ProductMapper', () => {
  it('round-trips through toPersistence -> toDomain', () => {
    const original = Product.create({
      sku: Sku.create('TSHIRT-BLU-M'),
      name: 'Blue T-Shirt',
      description: 'A shirt',
      categoryId: 'cat-1',
      price: Money.create(1999, 'USD'),
    });

    const row = ProductMapper.toPersistence(original);
    const rehydrated = ProductMapper.toDomain(row);

    expect(rehydrated.id).toBe(original.id);
    expect(rehydrated.sku.equals(original.sku)).toBe(true);
    expect(rehydrated.price.toCents()).toBe(1999);
    expect(rehydrated.price.getCurrency()).toBe('USD');
    expect(rehydrated.status).toBe('ACTIVE');
  });

  it('toPersistence produces plain values, not the value objects', () => {
    const product = Product.create({
      sku: Sku.create('ABC-123'),
      name: 'X',
      description: 'Y',
      categoryId: 'cat-1',
      price: Money.create(500, 'USD'),
    });

    const row = ProductMapper.toPersistence(product);
    expect(typeof row.sku).toBe('string');
    expect(typeof row.priceCents).toBe('number');
    expect(typeof row.currency).toBe('string');
  });
});
