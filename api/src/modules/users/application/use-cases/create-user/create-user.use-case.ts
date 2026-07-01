import { UserStatus } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { AuthProvider } from '@/modules/users/domain/entities/auth-provider.entity';
import { User } from '@/modules/users/domain/entities/user.entity';
import { AuthProviderFactory } from '@/modules/users/domain/factories/auth-provider.factory';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';
import { UserEmailAlreadyExistsError, UsernameAlreadyExistsError } from '@/modules/users/application/errors';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CreateUserUseCaseInput, CreateUserUseCaseOutput } from './create-user.dto';

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly outboxWriteService: OutboxWriteService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(data: CreateUserUseCaseInput, options?: IRepositoryOptions): Promise<CreateUserUseCaseOutput> {
    if (options?.manager) {
      return this.executeWithManager(data, {
        manager: options.manager,
      });
    }

    return this.dataSource.transaction(manager => this.executeWithManager(data, { manager }));
  }

  private async executeWithManager(
    data: CreateUserUseCaseInput,
    options: { manager: EntityManager },
  ): Promise<CreateUserUseCaseOutput> {
    const email = Email.create(data.email);

    const existingUserByEmail = await this.userRepository.findByEmail(email, options);

    if (existingUserByEmail) {
      throw new UserEmailAlreadyExistsError(email.value);
    }

    let userName: UserName | null = null;

    if (data.userName) {
      userName = UserName.create(data.userName);

      const existingUserByUserName = await this.userRepository.findByUserName(userName, options);

      if (existingUserByUserName) {
        throw new UsernameAlreadyExistsError(userName.value);
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
        avatarAssetId: null,
        authProviders,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      userId,
    );

    const savedUser = await this.userRepository.save(user, options);
    const domainEvents = user.pullDomainEvents();

    await this.outboxWriteService.storeEvents(domainEvents, {
      manager: options.manager,
    });

    return savedUser;
  }
}
