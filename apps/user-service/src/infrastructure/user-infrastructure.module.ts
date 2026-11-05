import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { KafkaClientModule } from '@ecommerce-platform/kafka-client';
import { KafkaTopics } from '@ecommerce-platform/contracts';
import {
  OUTBOX_PUBLISHER_OPTIONS,
  OUTBOX_STORE,
  OutboxPublisherOptions,
  OutboxPublisherService,
} from '@ecommerce-platform/outbox-publisher';
import { USER_REPOSITORY } from '../application/ports/user-repository.port';
import { PASSWORD_HASHER } from '../application/ports/password-hasher.port';
import { TOKEN_SERVICE } from '../application/ports/token-service.port';
import { REFRESH_TOKEN_BLOCKLIST } from '../application/ports/refresh-token-blocklist.port';
import { PrismaService } from './persistence/prisma.service';
import { PrismaUserRepository } from './persistence/prisma-user.repository';
import { PrismaOutboxStore } from './persistence/prisma-outbox.store';
import { Argon2PasswordHasher } from './security/argon2-password-hasher';
import { JoseTokenService } from './security/jose-token.service';
import { RedisRefreshTokenBlocklist } from './security/redis-refresh-token-blocklist';
import { JWT_CONFIG, JwtConfig } from './security/jwt.config';
import { REDIS_CONFIG, RedisConfig } from './security/redis.config';
import { RedisHealthIndicator } from './health/redis-health.indicator';

/**
 * Wires every adapter built in Stage 2.2 (plus the Stage 3.2 outbox
 * publisher) to the port it satisfies. Application/domain code depends
 * only on the port tokens exported here - never on the concrete adapter
 * classes.
 *
 * Config values are read from env here, at the composition root - nothing
 * below this module touches process.env directly.
 */
@Module({
  imports: [
    TerminusModule,
    KafkaClientModule.forRoot({
      clientId: 'user-service',
      brokers: (process.env['KAFKA_BROKERS_HOST'] ?? 'localhost:29092').split(','),
      // No consumerGroupId - User Service only ever produces (via the
      // outbox publisher below), it doesn't consume from Kafka.
    }),
  ],
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
    {
      provide: OUTBOX_PUBLISHER_OPTIONS,
      useFactory: (): OutboxPublisherOptions => ({
        pollIntervalMs: Number(process.env['OUTBOX_POLL_INTERVAL_MS'] ?? 3000),
        batchSize: Number(process.env['OUTBOX_BATCH_SIZE'] ?? 50),
        maxRetries: Number(process.env['OUTBOX_MAX_RETRIES'] ?? 5),
        // User Service's outbox only ever contains "User" aggregateType
        // rows (currently just UserRegistered) - all going to the one
        // user-events topic.
        topicByAggregateType: { User: KafkaTopics.USER_EVENTS },
      }),
    },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JoseTokenService },
    { provide: REFRESH_TOKEN_BLOCKLIST, useClass: RedisRefreshTokenBlocklist },
    { provide: OUTBOX_STORE, useClass: PrismaOutboxStore },
    OutboxPublisherService,
    RedisHealthIndicator,
  ],
  exports: [
    USER_REPOSITORY,
    PASSWORD_HASHER,
    TOKEN_SERVICE,
    REFRESH_TOKEN_BLOCKLIST,
    PrismaService,
    RedisHealthIndicator,
  ],
})
export class UserInfrastructureModule {}
