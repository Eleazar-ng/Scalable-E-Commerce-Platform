import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

/**
 * Extracts the authenticated user's token payload, set by JwtAuthGuard.
 * Only valid on routes guarded by JwtAuthGuard - using it elsewhere will
 * read undefined.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
