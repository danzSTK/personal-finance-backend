import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import {
  IUserCacheInvalidator,
  UserCacheInvalidationContext,
} from '@/modules/users/application/ports/user-cache-invalidator.interface';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisUserCacheInvalidator implements IUserCacheInvalidator {
  constructor(private readonly cache: RedisService) {}

  async invalidate(user: User, context: UserCacheInvalidationContext = {}): Promise<void> {
    const currentUserName = user.userName?.value ?? null;
    const userNamesToInvalidate = new Set(
      [currentUserName, context.previousUserName ?? null].filter((userName): userName is string => userName !== null),
    );

    await Promise.all([
      this.cache.del(CacheKeys.users.byId(user.id)),
      this.cache.del(CacheKeys.users.byEmailIndex(user.email.value)),
      ...Array.from(userNamesToInvalidate).flatMap(userName => [
        this.cache.del(CacheKeys.users.byUserNameIndex(userName)),
        this.cache.del(CacheKeys.users.usernameAlreadyExists(userName)),
      ]),
    ]);
  }
}
