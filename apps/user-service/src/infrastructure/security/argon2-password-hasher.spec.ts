import { Argon2PasswordHasher } from './argon2-password-hasher';

jest.setTimeout(20000); // argon2id with these cost params can take a moment per call

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('produces an argon2id-formatted hash', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.verify('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.verify('wrong password', hash)).resolves.toBe(false);
  });

  it('returns false (not a throw) for a malformed hash string', async () => {
    await expect(hasher.verify('anything', 'not-a-real-hash')).resolves.toBe(false);
  });

  it('produces different hashes for the same input (random salt per call)', async () => {
    const hashA = await hasher.hash('same password');
    const hashB = await hasher.hash('same password');
    expect(hashA).not.toBe(hashB);
  });
});
