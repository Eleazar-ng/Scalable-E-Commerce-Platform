import { Sku } from './sku.vo';

describe('Sku', () => {
  it('creates a valid SKU and normalizes to uppercase', () => {
    const sku = Sku.create('tshirt-blu-m');
    expect(sku.toString()).toBe('TSHIRT-BLU-M');
  });

  it('trims whitespace', () => {
    expect(Sku.create('  ABC-123  ').toString()).toBe('ABC-123');
  });

  it('rejects an empty SKU', () => {
    expect(() => Sku.create('')).toThrow();
    expect(() => Sku.create('   ')).toThrow();
  });

  it('rejects invalid characters', () => {
    expect(() => Sku.create('ABC_123')).toThrow();
    expect(() => Sku.create('ABC 123')).toThrow();
    expect(() => Sku.create('ABC!123')).toThrow();
  });

  it('equals compares normalized values', () => {
    const a = Sku.create('abc-123');
    const b = Sku.create('ABC-123');
    expect(a.equals(b)).toBe(true);
  });
});
