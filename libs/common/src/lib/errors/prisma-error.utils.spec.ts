import { isPrismaUniqueConstraintError } from './prisma-error.utils';

describe('isPrismaUniqueConstraintError', () => {
  it('returns true for a P2002 error object', () => {
    expect(isPrismaUniqueConstraintError({ code: 'P2002', meta: { target: ['email'] } })).toBe(
      true
    );
  });

  it('returns false for a different Prisma error code', () => {
    expect(isPrismaUniqueConstraintError({ code: 'P2025' })).toBe(false);
  });

  it('returns false for a plain Error', () => {
    expect(isPrismaUniqueConstraintError(new Error('boom'))).toBe(false);
  });

  it('returns false for null, undefined, and primitives', () => {
    expect(isPrismaUniqueConstraintError(null)).toBe(false);
    expect(isPrismaUniqueConstraintError(undefined)).toBe(false);
    expect(isPrismaUniqueConstraintError('P2002')).toBe(false);
  });
});
