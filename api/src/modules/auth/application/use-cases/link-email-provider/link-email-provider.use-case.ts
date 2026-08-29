import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AuthProviderType } from '@/common/models/enums';
import { IHashService } from '@/common/models/interfaces';
import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { type LinkEmailProviderUseCaseDto } from './link-email-provider.dto';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import {
  AuthProviderAlreadyLinkedError,
  AuthProviderLinkedToAnotherUserError,
} from '@/modules/auth/application/errors';
import { UserNotFoundError } from '@/modules/users/application/errors';

const AUTH_PROVIDER_UNIQUE_CONSTRAINT = 'UQ_auth_providers';

@Injectable()
export class LinkEmailProviderUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashService: IHashService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(data: LinkEmailProviderUseCaseDto): Promise<void> {
    const passwordHash = await this.hashService.hash(data.password);

    try {
      await this.dataSource.transaction(async manager => {
        const user = await this.userRepository.findByIdForUpdate(data.userId, { manager });

        if (!user) {
          throw new UserNotFoundError();
        }

        if (user.getCredentialsAuthProvider()) {
          throw new AuthProviderAlreadyLinkedError(AuthProviderType.EMAIL);
        }

        const canonicalEmail = user.email.value;
        const existingEmailProvider = await this.userRepository.findByAuthProvider(
          AuthProviderType.EMAIL,
          canonicalEmail,
          { manager },
        );

        if (existingEmailProvider && existingEmailProvider.id !== user.id) {
          throw new AuthProviderLinkedToAnotherUserError(AuthProviderType.EMAIL);
        }

        user.addAuthProvider(
          randomUUID(),
          AuthProviderType.EMAIL,
          canonicalEmail,
          HashedPassword.createFromHash(passwordHash),
        );

        await this.userRepository.save(user, { manager });
      });
    } catch (error) {
      if (isPostgresUniqueViolation(error) && getPostgresConstraintName(error) === AUTH_PROVIDER_UNIQUE_CONSTRAINT) {
        throw new AuthProviderLinkedToAnotherUserError(AuthProviderType.EMAIL);
      }

      throw error;
    }
  }
}
