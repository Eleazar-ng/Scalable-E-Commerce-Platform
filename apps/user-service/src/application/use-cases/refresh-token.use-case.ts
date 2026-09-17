import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedException } from '@ecommerce-platform/common';
import {
  REFRESH_TOKEN_BLOCKLIST,
  RefreshTokenBlocklistPort,
} from '../ports/refresh-token-blocklist.port';
import { TOKEN_SERVICE, TokenServicePort } from '../ports/token-service.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../ports/user-repository.port';
import { JWT_CONFIG, JwtConfig } from '../../infrastructure/security/jwt.config';
import { parseJwtTtlToSeconds } from '../utils/jwt-ttl.util';

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Rotation strategy (Stage 2.3 planning decision): every refresh call
 * blocklists the OLD refresh token's jti and issues a brand-new refresh
 * token, limiting how long a stolen refresh token stays useful. The old
 * jti is blocked for a full refreshTokenTtl duration - simpler and safer
 * than trying to compute its exact remaining lifetime, at the cost of a
 * small amount of extra Redis memory versus the theoretical minimum.
 */
@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort,
    @Inject(REFRESH_TOKEN_BLOCKLIST) private readonly blocklist: RefreshTokenBlocklistPort,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(JWT_CONFIG) private readonly jwtConfig: JwtConfig
  ) {}

  async execute(refreshToken: string): Promise<RefreshResult> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    if (await this.blocklist.isBlocked(payload.jti)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    await this.blocklist.block(payload.jti, parseJwtTtlToSeconds(this.jwtConfig.refreshTokenTtl));

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email.toString(),
      role: user.role,
    });
    const { token: newRefreshToken } = await this.tokenService.signRefreshToken({ sub: user.id });

    return { accessToken, refreshToken: newRefreshToken };
  }
}
