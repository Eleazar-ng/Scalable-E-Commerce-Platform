import { Inject, Injectable } from '@nestjs/common';
import { NotFoundException } from '@ecommerce-platform/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../ports/user-repository.port';

@Injectable()
export class DeleteAccountUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found', { userId });
    }

    // Validates the domain invariant (throws UserAlreadyDeletedException on
    // a redundant delete) and anonymizes the email BEFORE touching the
    // database - findById already filters out deleted users, so this
    // mainly guards a race condition rather than the common case.
    user.softDelete();
    await this.userRepository.softDelete(user.id, user.email);
  }
}
