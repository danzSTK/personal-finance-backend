import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthProviderType, UserStatus } from '../../../../../common/models/enums';
import { IHashService } from '../../../../../common/models/interfaces';
import { IUserRepository } from '../../../../users/domain/repositories/user.respository.interface';
import { FindUserByEmailUseCase } from '../../../../users/application/use-cases/find-by-user-email/find-user-by-email.use-case';
import { FindUserByUserNameUseCase } from '../../../../users/application/use-cases/find-by-user-name/find-by-user-name.use-case';
import { CreateUserUseCase } from '../../../../users/application/use-cases/create-user/create-user.use-case';
import { GenerateTokenUseCase } from '../generate-token/generate-token.use-case';
import { type SignUpUseCaseOutput, type SignUpUseCaseInput } from './sign-up.dto';

@Injectable()
export class SignUpUseCase {
  constructor(
    private readonly findUserByEmailUseCase: FindUserByEmailUseCase,
    private readonly findUserByUserNameUseCase: FindUserByUserNameUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly userRepository: IUserRepository,
    private readonly hashService: IHashService,
    private readonly generateTokenUseCase: GenerateTokenUseCase,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(data: SignUpUseCaseInput): Promise<SignUpUseCaseOutput> {
    const passwordHash = await this.hashService.hash(data.password);

    const result = await this.dataSource.transaction(async manager => {
      const existingEmailProvider = await this.userRepository.findByAuthProvider(AuthProviderType.EMAIL, data.email, {
        manager,
      });

      if (existingEmailProvider) {
        throw new ConflictException('Email already registered');
      }

      const user = await this.findUserByEmailUseCase.execute(data.email, { manager });

      if (user) {
        throw new ConflictException('Email already registered');
      }

      const existingUsername = await this.findUserByUserNameUseCase.execute(data.userName, { manager });

      if (existingUsername) {
        throw new ConflictException('User name already registered');
      }

      return this.createUserUseCase.execute(
        {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          userName: data.userName,
          status: UserStatus.ACTIVE,
          authProviders: [
            {
              provider: AuthProviderType.EMAIL,
              providerUserId: data.email,
              passwordHash,
            },
          ],
        },
        { manager },
      );
    });

    const { accessToken, refreshToken } = await this.generateTokenUseCase.execute({
      userId: result.id,
      email: result.email.value,
      status: result.status,
      sessionMetadata: data.sessionMetadata,
    });

    return { accessToken, refreshToken, user: result };
  }
}
