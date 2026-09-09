import { PasswordHash } from './password-hash.vo';

describe('PasswordHash', () => {
  it('wraps a non-empty hash string', () => {
    const hash = PasswordHash.fromHash('$argon2id$v=19$m=65536,t=3,p=4$somesalt$somehash');
    expect(hash.toString()).toBe('$argon2id$v=19$m=65536,t=3,p=4$somesalt$somehash');
  });

  it('rejects an empty string', () => {
    expect(() => PasswordHash.fromHash('')).toThrow();
  });

  it('rejects a whitespace-only string', () => {
    expect(() => PasswordHash.fromHash('   ')).toThrow();
  });
});
