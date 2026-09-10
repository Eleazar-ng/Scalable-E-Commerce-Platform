import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHasherPort } from '../../application/ports/password-hasher.port';

/**
 * argon2id implementation of PasswordHasherPort (architecture decision 16).
 * Cost parameters follow OWASP's current baseline recommendation for
 * argon2id (as of the 2023+ cheat sheet): m=19MiB minimum is the floor for
 * weaker profiles, but for a service handling real auth we use a stronger
 * profile more in line with argon2's own recommended defaults for
 * server-side use.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasherPort {
  private readonly options: argon2.HashOptions = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 4,
  };

  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, this.options);
  }

  async verify(plaintext: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      // argon2.verify throws on a malformed hash string (not a mismatch -
      // a genuine wrong-password mismatch resolves false, not a throw).
      // Treat a malformed hash the same as "does not match" rather than
      // letting an exception propagate for what is, from the caller's
      // perspective, just a failed login attempt.
      return false;
    }
  }
}
