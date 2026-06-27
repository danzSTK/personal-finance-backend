import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import { UserNotFoundError } from '@/modules/users/application/errors';
import { UsernameAlreadyExistsError } from '@/modules/users/application/errors/username-already-exists.error';
import {
  UpdateUsernameUseCaseInput,
  UpdateUsernameUseCaseOutput,
} from '@/modules/users/application/use-cases/update-username/update-username.dto';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

const USER_NAME_UNIQUE_CONSTRAINT = 'UQ_user_name';

@Injectable()
export class UpdateUsernameUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(data: UpdateUsernameUseCaseInput): Promise<UpdateUsernameUseCaseOutput> {
    const { userId, newUsername } = data;

    return this.dataSource.transaction(async manager => {
      const user = await this.userRepository.findByIdForUpdate(userId, { manager });

      if (!user) {
        throw new UserNotFoundError();
      }

      const userName = UserName.create(newUsername);

      if (user.userName?.equals(userName)) {
        return user;
      }

      const userWithUsername = await this.userRepository.findByUserName(userName, { manager });

      if (userWithUsername && userWithUsername.id !== user.id) {
        throw new UsernameAlreadyExistsError(userName.value);
      }

      user.changeUserName(userName);

      return this.saveUser(user, userName, manager);
    });
  }

  private async saveUser(user: User, userName: UserName, manager: EntityManager): Promise<UpdateUsernameUseCaseOutput> {
    try {
      return await this.userRepository.save(user, { manager });
    } catch (error) {
      if (this.isUsernameUniqueViolation(error)) {
        throw new UsernameAlreadyExistsError(userName.value);
      }

      throw error;
    }
  }

  private isUsernameUniqueViolation(error: unknown): boolean {
    return isPostgresUniqueViolation(error) && getPostgresConstraintName(error) === USER_NAME_UNIQUE_CONSTRAINT;
  }
}
