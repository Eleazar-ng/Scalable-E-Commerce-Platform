export const REDIS_CONFIG = Symbol('REDIS_CONFIG');

export interface RedisConfig {
  /** e.g. "redis://:password@localhost:6379" */
  url: string;
  /** Key prefix for this service's keys, to avoid collisions if Redis is ever shared more broadly than planned. */
  keyPrefix?: string;
}
