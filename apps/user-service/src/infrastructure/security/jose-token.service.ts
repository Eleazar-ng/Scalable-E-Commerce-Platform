import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { importPKCS8, importSPKI, CryptoKey, jwtVerify, SignJWT } from 'jose';
import { UnauthorizedException } from '@ecommerce-platform/common';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenServicePort,
} from '../../application/ports/token-service.port';
import { JWT_CONFIG, JwtConfig } from './jwt.config';

const ALGORITHM = 'EdDSA'; // Ed25519 - chosen over RSA for smaller keys/faster verify

/**
 * jose-based implementation of TokenServicePort using EdDSA (Ed25519).
 * Keys are imported lazily and cached on first use, rather than at
 * construction, so a service that somehow never issues/verifies a token
 * never pays the key-import cost - same lazy pattern used by
 * KafkaConsumerAdapter in libs/kafka-client.
 */
@Injectable()
export class JoseTokenService implements TokenServicePort {
  private privateKeyPromise: Promise<CryptoKey> | null = null;
  private publicKeyPromise: Promise<CryptoKey> | null = null;

  constructor(@Inject(JWT_CONFIG) private readonly config: JwtConfig) {}

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    const key = await this.getPrivateKey();
    return new SignJWT({ email: payload.email, role: payload.role })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(payload.sub)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime(this.config.accessTokenTtl)
      .sign(key);
  }

  async signRefreshToken(payload: { sub: string }): Promise<{ token: string; jti: string }> {
    const key = await this.getPrivateKey();
    const jti = randomUUID();

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(payload.sub)
      .setJti(jti)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime(this.config.refreshTokenTtl)
      .sign(key);

    return { token, jti };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const key = await this.getPublicKey();
    try {
      const { payload } = await jwtVerify(token, key, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      return {
        sub: payload.sub as string,
        email: payload['email'] as string,
        role: payload['role'] as string,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired access token', {
        cause: (error as Error).message,
      });
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const key = await this.getPublicKey();
    try {
      const { payload } = await jwtVerify(token, key, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      return { sub: payload.sub as string, jti: payload.jti as string };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token', {
        cause: (error as Error).message,
      });
    }
  }

  private getPrivateKey(): Promise<CryptoKey> {
    if (!this.privateKeyPromise) {
      this.privateKeyPromise = importPKCS8(this.config.privateKeyPem, ALGORITHM);
    }
    return this.privateKeyPromise;
  }

  private getPublicKey(): Promise<CryptoKey> {
    if (!this.publicKeyPromise) {
      this.publicKeyPromise = importSPKI(this.config.publicKeyPem, ALGORITHM);
    }
    return this.publicKeyPromise;
  }
}
