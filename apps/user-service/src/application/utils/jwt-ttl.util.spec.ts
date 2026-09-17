import { parseJwtTtlToSeconds } from './jwt-ttl.util';

describe('parseJwtTtlToSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['1h', 3600],
    ['7d', 604800],
  ])('parses %s as %i seconds', (input, expected) => {
    expect(parseJwtTtlToSeconds(input)).toBe(expected);
  });

  it('tolerates a space between amount and unit', () => {
    expect(parseJwtTtlToSeconds('7 d')).toBe(604800);
  });

  it('falls back to 7 days for an unparseable string', () => {
    expect(parseJwtTtlToSeconds('garbage')).toBe(604800);
  });

  it('falls back to 7 days for an unsupported unit', () => {
    expect(parseJwtTtlToSeconds('5 weeks')).toBe(604800);
  });
});
