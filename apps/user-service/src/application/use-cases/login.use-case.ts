import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@ecommerce-platform/common';
import { Email } from '../../domain/value-objects/email.vo';
import { USER_REPOSITORY, UserRepositoryPort } from '../ports/user-repository.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../ports/password-hasher.port';
import { TOKEN_SERVICE, TokenServicePort } from '../ports/token-service.port';
import { AuthResult } from './register-user.use-case';
import { toUserProfile } from '../dto/user-profile.dto';

export interface LoginInput {
  email: string;
  password: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort
  ) {}

  async execute(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(Email.create(input.email));

    // Deliberately identical error for "no such user" and "wrong password" -
    // avoids leaking whether an email is registered (standard practice
    // against account enumeration).
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await this.passwordHasher.verify(
      input.password,
      user.passwordHash.toString()
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'SUSPENDED') {
      // Credentials were correct, so disclosing account status here isn't
      // an enumeration risk the way it would be pre-authentication.
      throw new ForbiddenException('This account has been suspended');
    }

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email.toString(),
      role: user.role,
    });
    const { token: refreshToken } = await this.tokenService.signRefreshToken({ sub: user.id });

    return { user: toUserProfile(user), accessToken, refreshToken };
  }
}
