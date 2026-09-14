import { GracefulShutdownService } from '@ecommerce-platform/common';
import { RedisRefreshTokenBlocklist } from './redis-refresh-token-blocklist';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    quit: jest.fn(),
    set: jest.fn(),
    exists: jest.fn(),
  }));
});

function buildShutdownServiceMock(): jest.Mocked<GracefulShutdownService> {
  return { registerHook: jest.fn() } as unknown as jest.Mocked<GracefulShutdownService>;
}

describe('RedisRefreshTokenBlocklist', () => {
  const config = { url: 'redis://localhost:6379' };

  it('connects and registers a shutdown hook on module init', async () => {
    const shutdown = buildShutdownServiceMock();
    const blocklist = new RedisRefreshTokenBlocklist(config, shutdown);
    await blocklist.onModuleInit();

    expect(shutdown.registerHook).toHaveBeenCalledWith('redis-disconnect', expect.any(Function));
  });

  it('block() sets a key with the configured TTL', async () => {
    const blocklist = new RedisRefreshTokenBlocklist(config, buildShutdownServiceMock());
    await blocklist.onModuleInit();

    await blocklist.block('jti-123', 3600);

    const client = (blocklist as any).client;
    expect(client.set).toHaveBeenCalledWith('refresh-token-blocklist:jti-123', '1', 'EX', 3600);
  });

  it('isBlocked() returns true when the key exists', async () => {
    const blocklist = new RedisRefreshTokenBlocklist(config, buildShutdownServiceMock());
    await blocklist.onModuleInit();
    const client = (blocklist as any).client;
    client.exists.mockResolvedValue(1);

    await expect(blocklist.isBlocked('jti-123')).resolves.toBe(true);
  });

  it('isBlocked() returns false when the key does not exist', async () => {
    const blocklist = new RedisRefreshTokenBlocklist(config, buildShutdownServiceMock());
    await blocklist.onModuleInit();
    const client = (blocklist as any).client;
    client.exists.mockResolvedValue(0);

    await expect(blocklist.isBlocked('jti-123')).resolves.toBe(false);
  });

  it('wraps a Redis failure on block() in ExternalServiceException', async () => {
    const blocklist = new RedisRefreshTokenBlocklist(config, buildShutdownServiceMock());
    await blocklist.onModuleInit();
    const client = (blocklist as any).client;
    client.set.mockRejectedValue(new Error('connection reset'));

    await expect(blocklist.block('jti-123', 3600)).rejects.toMatchObject({
      code: 'EXTERNAL_SERVICE_ERROR',
      retryable: true,
    });
  });

  it('respects a custom key prefix', async () => {
    const blocklist = new RedisRefreshTokenBlocklist(
      { url: 'redis://localhost:6379', keyPrefix: 'custom-prefix' },
      buildShutdownServiceMock()
    );
    await blocklist.onModuleInit();
    const client = (blocklist as any).client;

    await blocklist.block('jti-abc', 60);
    expect(client.set).toHaveBeenCalledWith('custom-prefix:jti-abc', '1', 'EX', 60);
  });
});
