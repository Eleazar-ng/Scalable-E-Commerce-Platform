import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import {
  GRACEFUL_SHUTDOWN_OPTIONS,
  GracefulShutdownOptions,
} from './graceful-shutdown.options';

export type ShutdownHook = () => Promise<void> | void;

interface RegisteredHook {
  name: string;
  hook: ShutdownHook;
}

/**
 * Runs registered cleanup hooks (Kafka producer/consumer disconnects,
 * Prisma disconnects, in-flight job drains, etc.) in the order they were
 * registered when the Nest application receives a shutdown signal.
 *
 * NestJS itself handles closing the underlying HTTP listener (stop
 * accepting new connections, let in-flight requests finish) as part of
 * `app.close()` when `app.enableShutdownHooks()` is enabled in main.ts -
 * this service is only responsible for the *additional* cleanup each
 * service needs (message brokers, DB connections, etc.), run after that.
 *
 * Usage in any service:
 *
 *   constructor(private readonly shutdown: GracefulShutdownService) {
 *     this.shutdown.registerHook('kafka', () => this.kafkaClient.disconnect());
 *   }
 */
@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly hooks: RegisteredHook[] = [];

  constructor(
    @Inject(GRACEFUL_SHUTDOWN_OPTIONS)
    private readonly options: GracefulShutdownOptions
  ) {}

  registerHook(name: string, hook: ShutdownHook): void {
    this.hooks.push({ name, hook });
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    const { serviceName, hooksTimeoutMs = 15_000 } = this.options;
    this.logger.log(
      `${serviceName} received shutdown signal (${signal ?? 'unknown'}) - running ${this.hooks.length} cleanup hook(s)`
    );

    const start = Date.now();
    const overallTimeout = this.delay(hooksTimeoutMs).then(() => {
      throw new Error(`Shutdown hooks exceeded ${hooksTimeoutMs}ms timeout`);
    });

    try {
      await Promise.race([this.runHooksSequentially(), overallTimeout]);
      this.logger.log(`${serviceName} shutdown complete in ${Date.now() - start}ms`);
    } catch (error) {
      this.logger.error(
        `${serviceName} shutdown did not complete cleanly: ${(error as Error).message}`
      );
    }
  }

  private async runHooksSequentially(): Promise<void> {
    for (const { name, hook } of this.hooks) {
      const hookStart = Date.now();
      try {
        await hook();
        this.logger.log(`Shutdown hook "${name}" completed in ${Date.now() - hookStart}ms`);
      } catch (error) {
        // A single failing hook should not prevent the remaining hooks
        // (e.g. Prisma disconnect) from still running.
        this.logger.error(`Shutdown hook "${name}" failed: ${(error as Error).message}`);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
