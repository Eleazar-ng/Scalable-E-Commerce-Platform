import { ReservationLine } from './reservation-line.vo';

describe('ReservationLine', () => {
  it('creates a valid line', () => {
    const line = ReservationLine.create('product-1', 3);
    expect(line.getProductId()).toBe('product-1');
    expect(line.getQuantity()).toBe(3);
  });

  it.each([0, -1, 1.5])('rejects an invalid quantity: %s', (qty) => {
    expect(() => ReservationLine.create('product-1', qty)).toThrow();
  });
});
