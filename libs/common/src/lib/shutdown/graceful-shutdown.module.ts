import { DynamicModule, Global, Module } from '@nestjs/common';
import {
  GRACEFUL_SHUTDOWN_OPTIONS,
  GracefulShutdownOptions,
} from './graceful-shutdown.options';
import { GracefulShutdownService } from './graceful-shutdown.service';

/**
 * Provides consistent, ordered shutdown across every service in the
 * platform. Import once in each service's AppModule:
 *
 *   GracefulShutdownModule.forRoot({ serviceName: 'payment-service' })
 *
 * and call `app.enableShutdownHooks()` in main.ts (see README for the full
 * bootstrap snippet). Individual shutdown steps (closing a Kafka
 * client, disconnecting Prisma, etc.) are registered by each service via
 * `GracefulShutdownService.registerHook(...)` - this module does not know
 * about Kafka or Prisma directly, keeping it a reusable, dependency-free
 * base per the ports & adapters approach.
 */
@Global()
@Module({})
export class GracefulShutdownModule {
  static forRoot(options: GracefulShutdownOptions): DynamicModule {
    return {
      module: GracefulShutdownModule,
      providers: [
        { provide: GRACEFUL_SHUTDOWN_OPTIONS, useValue: options },
        GracefulShutdownService,
      ],
      exports: [GracefulShutdownService],
    };
  }
}
