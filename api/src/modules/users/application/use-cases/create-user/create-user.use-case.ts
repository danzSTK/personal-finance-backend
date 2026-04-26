import { UserStatus } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { AuthProvider } from '@/modules/users/domain/entities/auth-provider.entity';
import { User } from '@/modules/users/domain/entities/user.entity';
import { AuthProviderFactory } from '@/modules/users/domain/factories/auth-provider.factory';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Email } from '@/modules/users/domain/value-objects/email.value-object';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';
import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateUserUseCaseInput, CreateUserUseCaseOutput } from './create-user.dto';

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(data: CreateUserUseCaseInput, options?: IRepositoryOptions): Promise<CreateUserUseCaseOutput> {
    const email = Email.create(data.email);

    const existingUserByEmail = await this.userRepository.findByEmail(email, options);

    if (existingUserByEmail) {
      throw new ConflictException('User with this email already registered');
    }

    let userName: UserName | null = null;

    if (data.userName) {
      userName = UserName.create(data.userName);

      const existingUserByUserName = await this.userRepository.findByUserName(userName, options);

      if (existingUserByUserName) {
        throw new ConflictException('User with this username already registered');
      }
    }

    const userId = randomUUID();
    const authProviders: AuthProvider[] = (data.authProviders ?? []).map(ap => {
      const passwordHash = ap.passwordHash ? HashedPassword.createFromHash(ap.passwordHash) : null;

      return AuthProviderFactory.create(
        {
          provider: ap.provider,
          providerUserId: ap.providerUserId,
          passwordHash,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        randomUUID(),
      );
    });

    const user = User.create(
      {
        email,
        userName,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        status: data.status ?? UserStatus.PENDING_PROFILE,
        authProviders,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      userId,
    );

    return this.userRepository.save(user, options);
  }
}
