import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AuthProviderType, UserStatus } from '../../../../../common/models/enums';
import { User } from '../../../../users/domain/entities/user.entity';
import { IUserRepository } from '../../../../users/domain/repositories/user.respository.interface';
import { FindUserByEmailUseCase } from '../../../../users/application/use-cases/find-by-user-email/find-user-by-email.use-case';
import { CreateUserUseCase } from '../../../../users/application/use-cases/create-user/create-user.use-case';
import { type OAuthCallbackUseCaseDto } from './oauth-callback.dto';

@Injectable()
export class OAuthCallbackUseCase {
  constructor(
    private readonly findUserByEmailUseCase: FindUserByEmailUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly userRepository: IUserRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(data: OAuthCallbackUseCaseDto): Promise<User> {
    const { googleId, email, name } = data;

    const existingUser = await this.userRepository.findByAuthProvider(AuthProviderType.GOOGLE, googleId);

    if (existingUser) {
      return existingUser;
    }

    return this.dataSource.transaction(async manager => {
      const user = await this.findUserByEmailUseCase.execute(email, { manager });

      if (user) {
        user.addAuthProvider(randomUUID(), AuthProviderType.GOOGLE, googleId, null);

        return this.userRepository.save(user, { manager });
      }

      const [firstName, ...rest] = name.split(' ');

      return this.createUserUseCase.execute(
        {
          email,
          firstName,
          lastName: rest.join(' ') || '',
          status: UserStatus.PENDING_PROFILE,
          authProviders: [
            {
              provider: AuthProviderType.GOOGLE,
              providerUserId: googleId,
              passwordHash: null,
            },
          ],
        },
        { manager },
      );
    });
  }
}
