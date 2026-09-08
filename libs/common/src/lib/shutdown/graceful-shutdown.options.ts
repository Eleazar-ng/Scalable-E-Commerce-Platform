export const GRACEFUL_SHUTDOWN_OPTIONS = Symbol('GRACEFUL_SHUTDOWN_OPTIONS');

export interface GracefulShutdownOptions {
  /** Used in shutdown log lines, e.g. "payment-service" */
  serviceName: string;
  /**
   * Max time (ms) to wait for in-flight HTTP requests to drain before
   * forcing shutdown to continue regardless. Default: 10_000.
   */
  httpDrainTimeoutMs?: number;
  /**
   * Max total time (ms) allowed for all registered shutdown hooks
   * (Kafka disconnect, Prisma disconnect, etc.) combined, before the
   * process exits anyway. Default: 15_000.
   */
  hooksTimeoutMs?: number;
}
