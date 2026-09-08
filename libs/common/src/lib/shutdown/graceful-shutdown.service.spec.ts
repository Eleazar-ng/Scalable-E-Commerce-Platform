import { GracefulShutdownService } from './graceful-shutdown.service';
import { GracefulShutdownOptions } from './graceful-shutdown.options';

describe('GracefulShutdownService', () => {
  const options: GracefulShutdownOptions = { serviceName: 'test-service', hooksTimeoutMs: 1000 };

  it('runs registered hooks in order', async () => {
    const service = new GracefulShutdownService(options);
    const order: string[] = [];

    service.registerHook('first', () => {
      order.push('first');
    });
    service.registerHook('second', async () => {
      order.push('second');
    });

    await service.onApplicationShutdown('SIGTERM');

    expect(order).toEqual(['first', 'second']);
  });

  it('continues running remaining hooks even if one fails', async () => {
    const service = new GracefulShutdownService(options);
    const order: string[] = [];

    service.registerHook('failing', () => {
      throw new Error('boom');
    });
    service.registerHook('after-failure', () => {
      order.push('after-failure');
    });

    await expect(service.onApplicationShutdown('SIGTERM')).resolves.not.toThrow();
    expect(order).toEqual(['after-failure']);
  });

  it('does not throw if hooks exceed the configured timeout', async () => {
    const service = new GracefulShutdownService({ serviceName: 'slow-service', hooksTimeoutMs: 50 });
    service.registerHook('slow', () => new Promise((resolve) => setTimeout(resolve, 500)));

    await expect(service.onApplicationShutdown('SIGTERM')).resolves.not.toThrow();
  });
});
