import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { EntityManager, Repository } from 'typeorm';
import { CacheKeys } from '../../common/utils/cache-keys.factory';
import { RedisService } from '../../database/redis/redis.service';

interface ICreateUserOptions {
  manager?: EntityManager;
}

interface IGetUserByEmailOptions {
  manager?: EntityManager;
}

interface IGetUserByIdOptions {
  manager?: EntityManager;
}

interface IGetUserByNameOptions {
  manager?: EntityManager;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  private readonly cacheTTL = 1000 * 60 * 60 * 24;

  async create(createUserDto: CreateUserDto, options?: ICreateUserOptions) {
    const newUserPayload: CreateUserDto = {
      ...createUserDto,
    };
    const repository = options?.manager ? options.manager.getRepository(User) : this.userRepository;

    if (createUserDto.userName) {
      newUserPayload.userName = createUserDto.userName.trim().toLowerCase();
    }

    if (createUserDto.email) {
      newUserPayload.email = createUserDto.email.trim().toLowerCase();
    }

    const user = repository.create(newUserPayload);

    return repository.save(user);
  }

  findAll() {
    return this.userRepository.find();
  }

  async findOne(userId: string) {
    const user = await this.findById(userId);

    return user;
  }

  async findById(id: string, options?: IGetUserByIdOptions): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(User) : this.userRepository;

    if (options?.manager) {
      const user = await repository.findOneBy({ id });

      return user;
    }

    const cacheKey = CacheKeys.users.byId(id);

    const cachedUser = await this.redisService.get<User>(cacheKey);

    if (cachedUser) {
      return cachedUser;
    }

    const user = await repository.findOne({
      where: {
        id,
      },
    });

    if (user) {
      await this.redisService.set(cacheKey, user, this.cacheTTL);
    }

    return user;
  }

  async findByEmail(email: string, options?: IGetUserByEmailOptions): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(User) : this.userRepository;

    if (options?.manager) {
      const user = await repository.findOne({
        where: {
          email,
        },
      });

      return user;
    }

    const indexKey = CacheKeys.users.byEmailIndex(email);
    const cachedUserId = await this.redisService.get<string>(indexKey);

    if (cachedUserId) {
      const user = await this.findById(cachedUserId, options);

      if (!user) {
        await this.redisService.del(indexKey);

        return null;
      }

      return user;
    }

    const user = await repository.findOne({ where: { email } });

    if (user) {
      await Promise.all([
        this.redisService.set(CacheKeys.users.byId(user.id), user, this.cacheTTL),
        this.redisService.set(indexKey, user.id, this.cacheTTL),
      ]);
    }

    return user;
  }

  async findByUserName(userName: string, options?: IGetUserByNameOptions): Promise<User | null> {
    const repository = options?.manager ? options.manager.getRepository(User) : this.userRepository;

    if (options?.manager) {
      const user = await repository.findOne({
        where: {
          userName: userName,
        },
      });

      return user;
    }

    const normalizedUserName = userName.trim().toLowerCase();
    const indexKey = CacheKeys.users.byUserNameIndex(normalizedUserName);

    const cachedUserId = await this.redisService.get<string>(indexKey);

    if (cachedUserId) {
      const user = await this.findById(cachedUserId, options);

      if (!user) {
        await this.redisService.del(indexKey);

        return null;
      }

      return user;
    }

    const user = await repository.findOne({
      where: {
        userName: normalizedUserName,
      },
    });

    if (user) {
      await this.redisService.set(CacheKeys.users.byId(user.id), user, this.cacheTTL);

      await this.redisService.set(indexKey, user.id, this.cacheTTL);
    }

    return user;
  }
}
