import { GracefulShutdownService } from '@ecommerce-platform/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn(),
  }));
});

function buildShutdownServiceMock(): jest.Mocked<GracefulShutdownService> {
  return { registerHook: jest.fn() } as unknown as jest.Mocked<GracefulShutdownService>;
}

describe('RedisHealthIndicator', () => {
  const config = { url: 'redis://localhost:6379' };

  it('connects and registers a shutdown hook on module init', async () => {
    const shutdown = buildShutdownServiceMock();
    const healthIndicatorService = new HealthIndicatorService();
    const indicator = new RedisHealthIndicator(config, healthIndicatorService, shutdown);

    await indicator.onModuleInit();

    const client = (indicator as any).client;
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(shutdown.registerHook).toHaveBeenCalledWith(
      'redis-health-disconnect',
      expect.any(Function)
    );
  });

  it('reports up when ping succeeds', async () => {
    const healthIndicatorService = new HealthIndicatorService();
    const indicator = new RedisHealthIndicator(config, healthIndicatorService, buildShutdownServiceMock());
    await indicator.onModuleInit();

    const result = await indicator.check('redis');
    expect(result).toEqual({ redis: { status: 'up' } });
  });

  it('reports down when ping throws', async () => {
    const healthIndicatorService = new HealthIndicatorService();
    const indicator = new RedisHealthIndicator(config, healthIndicatorService, buildShutdownServiceMock());
    await indicator.onModuleInit();
    const client = (indicator as any).client;
    client.ping.mockRejectedValue(new Error('connection refused'));

    const result = await indicator.check('redis');
    expect(result).toEqual({ redis: { status: 'down', message: 'connection refused' } });
  });
});
