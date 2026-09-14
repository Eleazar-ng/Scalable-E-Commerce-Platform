import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GracefulShutdownService } from '@ecommerce-platform/common';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Thin wrapper around the generated Prisma Client for User Service. Only
 * User Service imports its own generated client (from
 * apps/user-service/prisma/generated) - this is deliberately NOT shared
 * across services, consistent with database-per-service: each service's
 * Prisma Client is generated from, and only knows about, its own schema.
 *
 * NOTE: this file will only typecheck after running
 *   npx prisma generate --schema=./prisma/schema.prisma
 * from apps/user-service, since PrismaClient here is a generated type that
 * does not exist until that command has been run. It could not be run in
 * the sandbox this was built in (engine binary download is network-
 * blocked) - run it locally before trusting this file compiles.
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
    this.logger.log('Prisma connected (user-service)');
    this.shutdown.registerHook('prisma-disconnect', () => this.$disconnect());
  }
}
