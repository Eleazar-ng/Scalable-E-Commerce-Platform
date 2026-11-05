import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GracefulShutdownService } from '@ecommerce-platform/common';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Thin wrapper around the generated Prisma Client for Product Catalog
 * Service. Same pattern as User Service's PrismaService - own generated
 * client, never shared across services (database-per-service).
 *
 * NOTE: only typechecks after running
 *   npx prisma generate --schema=./prisma/schema.prisma
 * from apps/product-catalog-service - could not be run in the sandbox
 * this was built in (see User Service's PrismaService for the full
 * explanation of why).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly shutdown: GracefulShutdownService) {
    const connectionString = process.env.DATABASE_URL;
    super({
      adapter: new PrismaPg({connectionString}),
      errorFormat: 'pretty',
      // Query-level logging only in local/dev — kept out of the default
      // 'log' array here since it's driven by NODE_ENV inside onModuleInit
      // would require reading config, and Prisma's constructor runs before
      // Nest's DI is available. We keep this static and cheap; per-env
      // query logging can be revisited when we build structured logging.
      log: [
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected (product-catalog-service)');
    this.shutdown.registerHook('prisma-disconnect', () => this.$disconnect());
  }
}
