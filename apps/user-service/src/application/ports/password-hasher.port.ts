/**
 * Port for password hashing (architecture decision 16: argon2id).
 * Application/use-case code depends only on this interface - never on
 * argon2 directly - keeping the hashing algorithm swappable in principle.
 */
export interface PasswordHasherPort {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
