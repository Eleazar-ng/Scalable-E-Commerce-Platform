import { Email } from './email.vo';

describe('Email', () => {
  it('accepts a well-formed address', () => {
    const email = Email.create('user@example.com');
    expect(email.toString()).toBe('user@example.com');
  });

  it('normalizes to lowercase and trims whitespace', () => {
    const email = Email.create('  User@Example.COM  ');
    expect(email.toString()).toBe('user@example.com');
  });

  it.each(['not-an-email', 'missing-domain@', '@missing-local.com', 'spaces in@email.com', ''])(
    'rejects malformed address: %s',
    (raw) => {
      expect(() => Email.create(raw)).toThrow();
    }
  );

  it('two Email instances with the same address are equal', () => {
    const a = Email.create('user@example.com');
    const b = Email.create('USER@EXAMPLE.COM');
    expect(a.equals(b)).toBe(true);
  });

  it('two Email instances with different addresses are not equal', () => {
    const a = Email.create('a@example.com');
    const b = Email.create('b@example.com');
    expect(a.equals(b)).toBe(false);
  });
});
