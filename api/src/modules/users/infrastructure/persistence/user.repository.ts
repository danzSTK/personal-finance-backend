import { AuthProviderType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Email } from '@/modules/users/domain/value-objects/email.value-object';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserMapper } from '../mappers/user.mapper';
import { UserOrmEntity } from './user-orm-entity';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
  ) {}

  async findById(id: string, options?: IRepositoryOptions): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    const userOrm = await repository.findOne({
      where: {
        id,
      },
      relations: ['authProviders'],
    });

    if (!userOrm) {
      return null;
    }

    const user = UserMapper.toDomain(userOrm);

    return user;
  }

  async findByEmail(email: Email, options?: IRepositoryOptions): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    const userOrm = await repository.findOne({
      where: {
        email: email.value,
      },
      relations: ['authProviders'],
    });

    if (!userOrm) {
      return null;
    }

    return UserMapper.toDomain(userOrm);
  }

  async findByUserName(userName: UserName, options?: IRepositoryOptions): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    const userOrm = await repository.findOne({
      where: {
        userName: userName.value,
      },
      relations: ['authProviders'],
    });

    if (!userOrm) {
      return null;
    }

    const user = UserMapper.toDomain(userOrm);

    return user;
  }

  async findByAuthProvider(
    provider: AuthProviderType,
    providerUserId: string,
    options?: IRepositoryOptions,
  ): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    const useOrm = await repository.findOne({
      where: {
        authProviders: {
          provider,
          providerUserId,
        },
      },
      relations: ['authProviders'],
    });

    if (!useOrm) {
      return null;
    }

    return UserMapper.toDomain(useOrm);
  }

  async usernameAlreadyExists(userName: UserName, options?: IRepositoryOptions): Promise<boolean> {
    const repository = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    const count = await repository.count({
      where: {
        userName: userName.value,
      },
    });

    return count > 0;
  }

  async save(user: User, options?: IRepositoryOptions): Promise<User> {
    const repo = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    const userOrmData = UserMapper.toOrm(user);

    if (user.id) {
      userOrmData.id = user.id;
    }

    const saved = await repo.save(userOrmData);

    // TODO: Created by event domain pattern

    const savedFresh = await repo.findOne({
      where: { id: saved.id },
      relations: ['authProviders'],
    });

    return UserMapper.toDomain(savedFresh!);
  }
}
