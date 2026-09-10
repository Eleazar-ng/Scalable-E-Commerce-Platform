import { Module } from '@nestjs/common';
import { USER_REPOSITORY } from '../application/ports/user-repository.port';
import { PASSWORD_HASHER } from '../application/ports/password-hasher.port';
import { TOKEN_SERVICE } from '../application/ports/token-service.port';
import { REFRESH_TOKEN_BLOCKLIST } from '../application/ports/refresh-token-blocklist.port';
import { PrismaService } from './persistence/prisma.service';
import { PrismaUserRepository } from './persistence/prisma-user.repository';
import { Argon2PasswordHasher } from './security/argon2-password-hasher';
import { JoseTokenService } from './security/jose-token.service';
import { RedisRefreshTokenBlocklist } from './security/redis-refresh-token-blocklist';
import { JWT_CONFIG, JwtConfig } from './security/jwt.config';
import { REDIS_CONFIG, RedisConfig } from './security/redis.config';

/**
 * Wires every adapter built in Stage 2.2 to the port it satisfies.
 * Application/domain code (Stage 2.3 handlers) depends only on the port
 * tokens exported here (USER_REPOSITORY, PASSWORD_HASHER, TOKEN_SERVICE,
 * REFRESH_TOKEN_BLOCKLIST) - never on the concrete adapter classes.
 *
 * Config values are read from env here, at the composition root - nothing
 * below this module touches process.env directly.
 */
@Module({
  providers: [
    PrismaService,
    {
      provide: JWT_CONFIG,
      useFactory: (): JwtConfig => ({
        privateKeyPem: process.env['JWT_PRIVATE_KEY'] ?? '',
        publicKeyPem: process.env['JWT_PUBLIC_KEY'] ?? '',
        issuer: 'user-service',
        audience: 'ecommerce-platform',
        accessTokenTtl: process.env['JWT_ACCESS_TOKEN_TTL'] ?? '15m',
        refreshTokenTtl: process.env['JWT_REFRESH_TOKEN_TTL'] ?? '7d',
      }),
    },
    {
      provide: REDIS_CONFIG,
      useFactory: (): RedisConfig => ({
        url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
        keyPrefix: 'user-service:refresh-token-blocklist',
      }),
    },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JoseTokenService },
    { provide: REFRESH_TOKEN_BLOCKLIST, useClass: RedisRefreshTokenBlocklist },
  ],
  exports: [USER_REPOSITORY, PASSWORD_HASHER, TOKEN_SERVICE, REFRESH_TOKEN_BLOCKLIST],
})
export class UserInfrastructureModule {}
