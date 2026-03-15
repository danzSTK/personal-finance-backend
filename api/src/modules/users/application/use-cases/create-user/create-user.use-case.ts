import { ConflictException, Injectable } from '@nestjs/common';
import { IRepositoryOptions, IUserRepository } from '../../../domain/repositories/user.respository.interface';
import { CreateUserUseCaseDto } from './create-user.dto';
import { Email } from '../../../domain/value-objects/email.value-object';
import { UserName } from '../../../domain/value-objects/user-name.value-object';
import { User } from '../../../domain/entities/user.entity';
import { UserStatus } from '../../../../../common/models/enums';
import { AuthProvider } from '../../../domain/entities/auth-provider.entity';
import { HashedPassword } from '../../../domain/value-objects/hashed-password.value-object';
import { AuthProviderFactory } from '../../../domain/factories/auth-provider.factory';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(data: CreateUserUseCaseDto, options?: IRepositoryOptions) {
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
