import { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@ecommerce-platform/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenServicePort } from '../../../application/ports/token-service.port';

function buildContext(headers: Record<string, string>): ExecutionContext {
  const request = { headers, user: undefined } as any;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

function buildTokenServiceMock(): jest.Mocked<TokenServicePort> {
  return {
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
}

describe('JwtAuthGuard', () => {
  it('allows the request and attaches the payload when the token is valid', async () => {
    const tokenService = buildTokenServiceMock();
    tokenService.verifyAccessToken.mockResolvedValue({
      sub: 'user-1',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });
    const guard = new JwtAuthGuard(tokenService);
    const context = buildContext({ authorization: 'Bearer valid-token' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest() as any;
    expect(request.user).toEqual({ sub: 'user-1', email: 'jane@example.com', role: 'CUSTOMER' });
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('throws UnauthorizedException when no Authorization header is present', async () => {
    const tokenService = buildTokenServiceMock();
    const guard = new JwtAuthGuard(tokenService);
    const context = buildContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the header is not a Bearer token', async () => {
    const tokenService = buildTokenServiceMock();
    const guard = new JwtAuthGuard(tokenService);
    const context = buildContext({ authorization: 'Basic somecreds' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('propagates verification failure from TokenServicePort', async () => {
    const tokenService = buildTokenServiceMock();
    tokenService.verifyAccessToken.mockRejectedValue(new UnauthorizedException('expired'));
    const guard = new JwtAuthGuard(tokenService);
    const context = buildContext({ authorization: 'Bearer expired-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
