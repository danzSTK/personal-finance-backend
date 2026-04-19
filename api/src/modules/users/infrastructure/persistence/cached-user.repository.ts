import { Injectable } from '@nestjs/common';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { IRepositoryOptions, IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { UserRepository } from './user.repository';
import { RedisService } from '@/database/redis/redis.service';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Email } from '@/modules/users/domain/value-objects/email.value-object';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import { AuthProviderFactory } from '@/modules/users/domain/factories/auth-provider.factory';

interface CachedAuthProvider {
  id: string;
  provider: AuthProviderType;
  providerUserId: string;
  passwordHash: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface CachedUser {
  id: string;
  email: string;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  authProviders: CachedAuthProvider[];
}

@Injectable()
export class CachedUserRepository implements IUserRepository {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly cache: RedisService,
  ) {}

  private readonly cacheTtl = 1000 * 60 * 5;
  async findById(id: string, options?: IRepositoryOptions): Promise<User | null> {
    if (options?.manager) {
      return this.userRepository.findById(id, { manager: options.manager });
    }

    const cacheKey = CacheKeys.users.byId(id);
    const cached = await this.cache.get<CachedUser>(cacheKey);

    if (cached) {
      return this.hydrateUser(cached);
    }

    const user = await this.userRepository.findById(id);

    if (!user) {
      return null;
    }

    await this.cache.set(cacheKey, this.serializeUser(user), this.cacheTtl);

    return user;
  }

  async findByEmail(email: Email, options?: IRepositoryOptions): Promise<User | null> {
    if (options?.manager) {
      return this.userRepository.findByEmail(email, { manager: options.manager });
    }

    const cacheKey = CacheKeys.users.byEmailIndex(email.value);
    const cachedUserId = await this.cache.get<string>(cacheKey);

    if (cachedUserId) {
      const user = await this.findById(cachedUserId);

      if (!user) {
        await this.cache.del(cacheKey);

        return null;
      }

      return user;
    }

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      return null;
    }

    await Promise.all([
      this.cache.set(cacheKey, user.id, this.cacheTtl),
      this.cache.set(CacheKeys.users.byId(user.id), this.serializeUser(user), this.cacheTtl),
    ]);

    return user;
  }

  async findByUserName(userName: UserName, options?: IRepositoryOptions): Promise<User | null> {
    if (options?.manager) {
      return this.userRepository.findByUserName(userName, { manager: options.manager });
    }

    const cacheKey = CacheKeys.users.byUserNameIndex(userName.value);
    const cachedUserId = await this.cache.get<string>(cacheKey);

    if (cachedUserId) {
      const user = await this.findById(cachedUserId);

      if (!user) {
        await this.cache.del(cacheKey);

        return null;
      }

      return user;
    }

    const user = await this.userRepository.findByUserName(userName);

    if (!user) {
      return null;
    }

    await Promise.all([
      this.cache.set(cacheKey, user.id, this.cacheTtl),
      this.cache.set(CacheKeys.users.byId(user.id), this.serializeUser(user), this.cacheTtl),
    ]);

    return user;
  }

  async findByAuthProvider(
    provider: AuthProviderType,
    providerUserId: string,
    options?: IRepositoryOptions,
  ): Promise<User | null> {
    if (options?.manager) {
      return this.userRepository.findByAuthProvider(provider, providerUserId, { manager: options.manager });
    }

    const user = await this.userRepository.findByAuthProvider(provider, providerUserId);

    if (!user) {
      return null;
    }

    await this.cache.set(CacheKeys.users.byId(user.id), this.serializeUser(user), this.cacheTtl);
    return user;
  }

  async save(user: User, options?: IRepositoryOptions): Promise<User> {
    const saved = await this.userRepository.save(user, options);

    await Promise.all([this.invalidateUserCache(user)]);

    const userRefreshed = await this.userRepository.findById(saved.id, options);

    if (!userRefreshed) {
      throw new Error('User not found after save');
    }

    await this.cache.set(CacheKeys.users.byId(user.id), this.serializeUser(userRefreshed), this.cacheTtl);

    return userRefreshed;
  }

  private serializeUser(user: User): CachedUser {
    return {
      id: user.id,
      email: user.email.value,
      userName: user.userName?.value ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      authProviders: user.authProviders.map(ap => ({
        id: ap.id,
        provider: ap.provider,
        providerUserId: ap.providerUserId,
        passwordHash: ap.passwordHash?.value ?? null,
        userId: ap.userId,
        createdAt: ap.createdAt.toISOString(),
        updatedAt: ap.updatedAt.toISOString(),
      })),
    };
  }

  private hydrateUser(cached: CachedUser): User {
    return User.create(
      {
        email: Email.reconstitute(cached.email),
        userName: cached.userName ? UserName.create(cached.userName) : null,
        firstName: cached.firstName,
        lastName: cached.lastName,
        status: cached.status,
        createdAt: new Date(cached.createdAt),
        updatedAt: new Date(cached.updatedAt),
        authProviders: cached.authProviders.map(ap =>
          AuthProviderFactory.create(
            {
              provider: ap.provider,
              providerUserId: ap.providerUserId,
              passwordHash: ap.passwordHash ? HashedPassword.createFromHash(ap.passwordHash) : null,
              userId: ap.userId,
              createdAt: new Date(ap.createdAt),
              updatedAt: new Date(ap.updatedAt),
            },
            ap.id,
          ),
        ),
      },
      cached.id,
    );
  }

  private async invalidateUserCache(user: User): Promise<void> {
    await Promise.all([
      this.cache.del(CacheKeys.users.byId(user.id)),
      this.cache.del(CacheKeys.users.byEmailIndex(user.email.value)),
      user.userName ? this.cache.del(CacheKeys.users.byUserNameIndex(user.userName.value)) : Promise.resolve(),
    ]);
  }
}
