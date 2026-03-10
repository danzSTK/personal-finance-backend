import { InjectRepository } from '@nestjs/typeorm';
import { User, UserProps } from '../../domain/entities/user.entity';
import { IRepositoryOptions, IUserRepository } from '../../domain/repositories/user.respository.interface';
import { UserOrmEntity } from './user-orm-entity';
import { Repository } from 'typeorm';
import { RedisService } from '../../../../database/redis/redis.service';
import { CacheKeys } from '../../../../common/utils/cache-keys.factory';
import { UserMapper } from '../mappers/user.mapper';
import { Injectable } from '@nestjs/common';
import { Email } from '../../domain/value-objects/email.value-object';
import { UserName } from '../../domain/value-objects/user-name.value-object';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
    private readonly redis: RedisService,
  ) {}

  private readonly cacheTTL = 60;

  async findById(id: string, options?: IRepositoryOptions): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    if (options?.manager) {
      const userOrm = await repository.findOne({
        where: {
          id,
        },
      });

      if (!userOrm) {
        return null;
      }

      return UserMapper.toDomain(userOrm);
    }

    const cacheKey = CacheKeys.users.byId(id);
    const cached = await this.redis.get<UserProps & { id: string }>(cacheKey);

    if (cached) {
      return User.create(
        {
          email: Email.create(cached.email.toString()),
          userName: cached.userName ? UserName.create(cached.userName.toString()) : null,
          firstName: cached.firstName,
          lastName: cached.lastName,
          status: cached.status,
          createdAt: cached.createdAt,
          updatedAt: cached.updatedAt,
        },
        cached.id,
      );
    }

    const userOrm = await this.userRepository.findOne({
      where: {
        id,
      },
    });

    if (!userOrm) {
      return null;
    }

    const user = UserMapper.toDomain(userOrm);

    await this.redis.set(
      cacheKey,
      {
        email: user.email.value,
        userName: user.userName?.value ?? null,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        id: user.id,
      },
      this.cacheTTL,
    );

    return user;
  }

  async findByEmail(email: Email, options?: IRepositoryOptions): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    if (options?.manager) {
      const userOrm = await repository.findOne({
        where: {
          email: email.value,
        },
      });

      if (!userOrm) {
        return null;
      }

      return UserMapper.toDomain(userOrm);
    }

    const indexKey = CacheKeys.users.byEmailIndex(email.value);
    const cachedId = await this.redis.get<string>(indexKey);

    if (cachedId) {
      const user = await this.findById(cachedId);

      if (!user) {
        await this.redis.del(indexKey);

        return null;
      }

      return user;
    }

    const userOrm = await this.userRepository.findOne({
      where: {
        email: email.value,
      },
    });

    if (!userOrm) {
      return null;
    }

    const user = UserMapper.toDomain(userOrm);

    await Promise.all([
      this.redis.set(
        CacheKeys.users.byId(user.id),
        {
          email: user.email.value,
          userName: user.userName?.value ?? null,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          id: user.id,
        },
        this.cacheTTL,
      ),
      this.redis.set(indexKey, user.id, this.cacheTTL),
    ]);

    return user;
  }

  async findByUserName(userName: UserName, options?: IRepositoryOptions): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    if (options?.manager) {
      const userOrm = await repository.findOne({
        where: {
          userName: userName.value,
        },
      });

      if (!userOrm) {
        return null;
      }

      return UserMapper.toDomain(userOrm);
    }

    const indexKey = CacheKeys.users.byUserNameIndex(userName.value);
    const cachedId = await this.redis.get<string>(indexKey);

    if (cachedId) {
      const user = await this.findById(cachedId);

      if (!user) {
        await this.redis.del(indexKey);

        return null;
      }

      return user;
    }

    const userOrm = await this.userRepository.findOne({
      where: {
        userName: userName.value,
      },
    });

    if (!userOrm) {
      return null;
    }

    const user = UserMapper.toDomain(userOrm);

    await Promise.all([
      this.redis.set(
        CacheKeys.users.byId(user.id),
        {
          id: user.id,
          userName: user.userName?.value ?? null,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        this.cacheTTL,
      ),
      this.redis.set(indexKey, user.id, this.cacheTTL),
    ]);

    return user;
  }

  async save(user: User, options?: IRepositoryOptions): Promise<User> {
    const repo = options?.manager ? options.manager.getRepository(UserOrmEntity) : this.userRepository;

    const userOrmData = UserMapper.toOrm(user);

    if (user.id) {
      userOrmData.id = user.id;
    }

    const saved = await repo.save(userOrmData);

    const cacheKey = CacheKeys.users.byId(saved.id);
    const emailIndexKey = CacheKeys.users.byEmailIndex(saved.email);

    // TODO: Created by event domain pattern
    await Promise.all([
      this.redis.del(cacheKey),
      this.redis.del(emailIndexKey),
      saved.userName ? this.redis.del(CacheKeys.users.byUserNameIndex(saved.userName)) : Promise.resolve(),
    ]);

    return UserMapper.toDomain(saved as UserOrmEntity);
  }
}
