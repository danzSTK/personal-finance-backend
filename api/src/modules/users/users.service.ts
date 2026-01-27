import { Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { EntityManager, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { type Cache } from 'cache-manager';
import { CacheKeys } from '../../common/utils/cache-keys.factory';

interface ICreateUserOptions {
  manager?: EntityManager;
}

interface IGetUserByEmailOptions {
  manager?: EntityManager;
}

interface IGetUserByIdOptions {
  manager?: EntityManager;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async create(createUserDto: CreateUserDto, options?: ICreateUserOptions) {
    const repository = options?.manager
      ? options.manager.getRepository(User)
      : this.userRepository;

    const user = repository.create(createUserDto);

    return repository.save(user);
  }

  findAll() {
    return this.userRepository.find();
  }

  async findOne(userId: string) {
    const user = await this.findById(userId);

    return user;
  }

  async findByEmail(email: string, options?: IGetUserByEmailOptions) {
    const repository = options?.manager
      ? options.manager.getRepository(User)
      : this.userRepository;

    if (options?.manager) {
      const user = await repository.findOne({
        where: {
          email,
        },
      });

      return user;
    }

    const cacheKey = CacheKeys.users.byEmail(email);

    const cachedUser = await this.cacheManager.get<User>(cacheKey);

    if (cachedUser) {
      console.log('User found in cache');
      return cachedUser;
    }

    const user = await repository.findOneBy({ email });

    if (user) {
      await this.cacheManager.set(cacheKey, user, 1000 * 60 * 60 * 24);
    }

    return user;
  }

  async findById(id: string, options?: IGetUserByIdOptions) {
    const repository = options?.manager
      ? options.manager.getRepository(User)
      : this.userRepository;

    if (options?.manager) {
      const user = await repository.findOneBy({ id });

      return user;
    }

    const cacheKey = CacheKeys.users.byId(id);

    const cachedUser = await this.cacheManager.get<User>(cacheKey);

    if (cachedUser) {
      console.log('User found in cache');
      return cachedUser;
    }

    const user = await repository.findOne({
      where: {
        id,
      },
    });

    if (user) {
      await this.cacheManager.set(cacheKey, user, 1000 * 60 * 60 * 24);
    }

    return user;
  }
}
