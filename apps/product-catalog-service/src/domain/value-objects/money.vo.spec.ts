import { Money } from './money.vo';

describe('Money', () => {
  it('creates a valid amount', () => {
    const money = Money.create(1999, 'usd');
    expect(money.toCents()).toBe(1999);
    expect(money.getCurrency()).toBe('USD');
  });

  it('allows zero', () => {
    expect(() => Money.create(0, 'USD')).not.toThrow();
  });

  it.each([-1, 1.5, NaN])('rejects an invalid amount: %s', (amount) => {
    expect(() => Money.create(amount, 'USD')).toThrow();
  });

  it.each(['US', 'USDD', ''])('rejects an invalid currency code: %s', (currency) => {
    expect(() => Money.create(100, currency)).toThrow();
  });

  it('equals compares amount and currency', () => {
    const a = Money.create(1000, 'USD');
    const b = Money.create(1000, 'usd');
    const c = Money.create(1000, 'EUR');
    const d = Money.create(500, 'USD');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
  });
});
