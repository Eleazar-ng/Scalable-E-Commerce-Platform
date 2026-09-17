import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../infrastructure/persistence/prisma.service';
import { RedisHealthIndicator } from '../../infrastructure/health/redis-health.indicator';

/**
 * Standard liveness/readiness split (architecture decision: health checks
 * are a standing requirement for every service, alongside graceful
 * shutdown):
 *
 * - /health/live: is the process up at all? No dependency checks - this is
 *   what orchestrators (Kubernetes) use to decide whether to restart the
 *   container. Deliberately NOT wired through Terminus's indicator
 *   machinery, since a dependency outage should never cause a liveness
 *   probe to fail and trigger an unnecessary restart.
 * - /health/ready: is this service actually able to serve traffic right
 *   now? Checks real dependencies (Postgres via Prisma, Redis) - what a
 *   load balancer/readiness probe uses to decide whether to route traffic
 *   here.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisIndicator: RedisHealthIndicator
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.redisIndicator.check('redis'),
    ]);
  }
}
