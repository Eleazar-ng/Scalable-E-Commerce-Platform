import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  REFRESH_TOKEN_BLOCKLIST,
  RefreshTokenBlocklistPort,
} from '../ports/refresh-token-blocklist.port';
import { TOKEN_SERVICE, TokenServicePort } from '../ports/token-service.port';
import { JWT_CONFIG, JwtConfig } from '../../infrastructure/security/jwt.config';
import { parseJwtTtlToSeconds } from '../utils/jwt-ttl.util';

/**
 * Logout is deliberately forgiving: an already-expired or already-invalid
 * refresh token still results in a successful logout response (there's
 * nothing meaningful left to revoke), rather than surfacing an error for
 * what the caller experiences as a routine action.
 */
@Injectable()
export class LogoutUseCase {
  private readonly logger = new Logger(LogoutUseCase.name);

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort,
    @Inject(REFRESH_TOKEN_BLOCKLIST) private readonly blocklist: RefreshTokenBlocklistPort,
    @Inject(JWT_CONFIG) private readonly jwtConfig: JwtConfig
  ) {}

  async execute(refreshToken: string): Promise<void> {
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      await this.blocklist.block(payload.jti, parseJwtTtlToSeconds(this.jwtConfig.refreshTokenTtl));
    } catch (error) {
      this.logger.debug(`Logout called with an already-invalid refresh token: ${(error as Error).message}`);
    }
  }
}
