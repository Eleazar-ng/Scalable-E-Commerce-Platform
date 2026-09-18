import { Product } from './product.aggregate';
import { Sku } from './value-objects/sku.vo';
import { Money } from './value-objects/money.vo';
import {
  InvalidProductNameException,
  ProductAlreadyActiveException,
  ProductAlreadyDiscontinuedException,
} from './product.errors';

function buildParams(overrides: Partial<{ name: string }> = {}) {
  return {
    sku: Sku.create('TSHIRT-BLU-M'),
    name: overrides.name ?? 'Blue T-Shirt (M)',
    description: 'A comfortable blue t-shirt.',
    categoryId: 'cat-1',
    price: Money.create(1999, 'USD'),
  };
}

describe('Product.create', () => {
  it('creates an ACTIVE product', () => {
    const product = Product.create(buildParams());
    expect(product.status).toBe('ACTIVE');
    expect(product.name).toBe('Blue T-Shirt (M)');
  });

  it('trims the name and description', () => {
    const product = Product.create({ ...buildParams(), name: '  Blue T-Shirt  ' });
    expect(product.name).toBe('Blue T-Shirt');
  });

  it('rejects an empty name', () => {
    expect(() => Product.create(buildParams({ name: '' }))).toThrow(InvalidProductNameException);
  });

  it('generates a unique id per product', () => {
    const a = Product.create(buildParams());
    const b = Product.create(buildParams());
    expect(a.id).not.toBe(b.id);
  });
});

describe('Product.updateDetails', () => {
  it('updates name, description, and price', () => {
    const product = Product.create(buildParams());
    product.updateDetails({
      name: 'Updated Name',
      description: 'Updated description',
      price: Money.create(2499, 'USD'),
    });

    expect(product.name).toBe('Updated Name');
    expect(product.description).toBe('Updated description');
    expect(product.price.toCents()).toBe(2499);
  });

  it('rejects an empty name', () => {
    const product = Product.create(buildParams());
    expect(() =>
      product.updateDetails({ name: '', description: 'x', price: Money.create(100, 'USD') })
    ).toThrow(InvalidProductNameException);
  });
});

describe('Product status transitions', () => {
  it('discontinue() transitions ACTIVE -> DISCONTINUED', () => {
    const product = Product.create(buildParams());
    product.discontinue();
    expect(product.status).toBe('DISCONTINUED');
  });

  it('discontinue() throws if already discontinued', () => {
    const product = Product.create(buildParams());
    product.discontinue();
    expect(() => product.discontinue()).toThrow(ProductAlreadyDiscontinuedException);
  });

  it('reactivate() transitions DISCONTINUED -> ACTIVE', () => {
    const product = Product.create(buildParams());
    product.discontinue();
    product.reactivate();
    expect(product.status).toBe('ACTIVE');
  });

  it('reactivate() throws if already active', () => {
    const product = Product.create(buildParams());
    expect(() => product.reactivate()).toThrow(ProductAlreadyActiveException);
  });
});

describe('Product.changeCategory', () => {
  it('updates categoryId', () => {
    const product = Product.create(buildParams());
    product.changeCategory('cat-2');
    expect(product.categoryId).toBe('cat-2');
  });
});

describe('Product.reconstitute', () => {
  it('rehydrates from persisted props', () => {
    const now = new Date();
    const product = Product.reconstitute({
      id: 'existing-id',
      sku: Sku.create('ABC-123'),
      name: 'Existing',
      description: 'desc',
      categoryId: 'cat-1',
      price: Money.create(500, 'USD'),
      status: 'DISCONTINUED',
      createdAt: now,
      updatedAt: now,
    });

    expect(product.id).toBe('existing-id');
    expect(product.status).toBe('DISCONTINUED');
  });
});
