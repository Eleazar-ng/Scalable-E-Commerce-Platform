import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ExternalServiceException, GracefulShutdownService } from '@ecommerce-platform/common';
import { RefreshTokenBlocklistPort } from '../../application/ports/refresh-token-blocklist.port';
import { REDIS_CONFIG, RedisConfig } from './redis.config';

/**
 * ioredis-backed implementation of RefreshTokenBlocklistPort. Uses Redis's
 * own key expiry (SET ... EX) rather than a manual cleanup job - a blocked
 * jti simply falls out of Redis on its own once the TTL (matched to the
 * refresh token's remaining lifetime) elapses, so the blocklist never
 * grows unbounded.
 */
@Injectable()
export class RedisRefreshTokenBlocklist implements RefreshTokenBlocklistPort, OnModuleInit {
  private readonly logger = new Logger(RedisRefreshTokenBlocklist.name);
  private readonly client: Redis;
  private readonly keyPrefix: string;

  constructor(
    @Inject(REDIS_CONFIG) config: RedisConfig,
    private readonly shutdown: GracefulShutdownService
  ) {
    this.client = new Redis(config.url, { lazyConnect: true });
    this.keyPrefix = config.keyPrefix ?? 'refresh-token-blocklist';
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Redis connected (refresh token blocklist)');
    this.shutdown.registerHook('redis-disconnect', async () => {
      await this.client.quit();
    });
  }

  async block(jti: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(this.key(jti), '1', 'EX', ttlSeconds);
    } catch (error) {
      throw new ExternalServiceException('Failed to block refresh token', {
        retryable: true,
        context: { jti },
        cause: error,
      });
    }
  }

  async isBlocked(jti: string): Promise<boolean> {
    try {
      const result = await this.client.exists(this.key(jti));
      return result === 1;
    } catch (error) {
      throw new ExternalServiceException('Failed to check refresh token blocklist', {
        retryable: true,
        context: { jti },
        cause: error,
      });
    }
  }

  private key(jti: string): string {
    return `${this.keyPrefix}:${jti}`;
  }
}
