import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';
import { GracefulShutdownService } from '@ecommerce-platform/common';
import { REDIS_CONFIG, RedisConfig } from '../security/redis.config';

/**
 * A dedicated, persistent Redis connection used only for health checks -
 * deliberately separate from RedisRefreshTokenBlocklist's connection
 * rather than sharing one, to keep each adapter's lifecycle independent
 * and avoid the two providers racing to call .connect() on a shared
 * client. Two lightweight connections per service is a normal,
 * inexpensive tradeoff for that isolation.
 *
 * Uses @nestjs/terminus v11's HealthIndicatorService (.up()/.down()) -
 * NOT v12's newer .attempt()-based API, which doesn't exist yet in v11.
 * v12 was tried first but is ESM-only ("type": "module", no CJS build),
 * incompatible with this project's CommonJS Jest setup - same category of
 * issue as jose v6 in Stage 2.2. v11 supports Nest 11 and is CJS.
 */
@Injectable()
export class RedisHealthIndicator implements OnModuleInit {
  private readonly logger = new Logger(RedisHealthIndicator.name);
  private readonly client: Redis;

  constructor(
    @Inject(REDIS_CONFIG) config: RedisConfig,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly shutdown: GracefulShutdownService
  ) {
    this.client = new Redis(config.url, { lazyConnect: true });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Redis connected (health indicator)');
    this.shutdown.registerHook('redis-health-disconnect', async () => {
      await this.client.quit();
    });
  }

  async check(key: string): Promise<HealthIndicatorResult> {
    const session = this.healthIndicatorService.check(key);
    try {
      await this.client.ping();
      return session.up();
    } catch (error) {
      return session.down({ message: (error as Error).message });
    }
  }
}
