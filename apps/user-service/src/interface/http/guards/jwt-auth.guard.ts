import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { UnauthorizedException } from '@ecommerce-platform/common';
import { AccessTokenPayload, TOKEN_SERVICE, TokenServicePort } from '../../../application/ports/token-service.port';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

/**
 * Verifies the Authorization: Bearer <token> header against
 * TokenServicePort and attaches the decoded payload to `request.user`.
 * Apply with @UseGuards(JwtAuthGuard) on any endpoint that requires
 * authentication.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user = await this.tokenService.verifyAccessToken(token);
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice('Bearer '.length).trim() || undefined;
  }
}
