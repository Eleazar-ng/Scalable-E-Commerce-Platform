import { Inject, Injectable } from '@nestjs/common';
import { ConflictException, NewOutboxRow } from '@ecommerce-platform/common';
import { userRegisteredPayloadSchema } from '@ecommerce-platform/contracts';
import { User } from '../../domain/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo';
import { USER_REPOSITORY, UserRepositoryPort } from '../ports/user-repository.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../ports/password-hasher.port';
import { TOKEN_SERVICE, TokenServicePort } from '../ports/token-service.port';
import { UserProfile, toUserProfile } from '../dto/user-profile.dto';

export interface RegisterUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResult {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

/**
 * Registers a new user, auto-issues tokens (architecture decision: Stage
 * 2.3 planning - auto-login on registration), and atomically records the
 * UserRegistered outbox event alongside the user row via
 * createWithOutboxEvents (the actual Kafka publish happens later, once the
 * Stage 3.2 polling publisher exists).
 */
@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthResult> {
    const email = Email.create(input.email);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists', {
        email: input.email,
      });
    }

    const hash = await this.passwordHasher.hash(input.password);
    const user = User.register({
      email,
      passwordHash: PasswordHash.fromHash(hash),
      firstName: input.firstName,
      lastName: input.lastName,
    });

    const outboxRows = this.buildOutboxRows(user);
    await this.userRepository.createWithOutboxEvents(user, outboxRows);

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email.toString(),
      role: user.role,
    });
    const { token: refreshToken } = await this.tokenService.signRefreshToken({ sub: user.id });

    return { user: toUserProfile(user), accessToken, refreshToken };
  }

  private buildOutboxRows(user: User): NewOutboxRow[] {
    return user.pullDomainEvents().map((event) => {
      switch (event.type) {
        case 'UserRegistered': {
          // Validated against the contracts schema before it's written to
          // the outbox table, catching a payload-shape bug here rather
          // than at publish time in Stage 3.2.
          const payload = userRegisteredPayloadSchema.parse({
            userId: event.userId,
            email: event.email,
            firstName: event.firstName,
          });
          return {
            aggregateType: 'User',
            aggregateId: user.id,
            eventType: 'UserRegistered',
            payload,
          };
        }
      }
    });
  }
}
