import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import { IUserCacheInvalidator } from '@/modules/users/application/ports/user-cache-invalidator.interface';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisUserCacheInvalidator implements IUserCacheInvalidator {
  constructor(private readonly cache: RedisService) {}

  async invalidate(user: User): Promise<void> {
    await Promise.all([
      this.cache.del(CacheKeys.users.byId(user.id)),
      this.cache.del(CacheKeys.users.byEmailIndex(user.email.value)),
      user.userName ? this.cache.del(CacheKeys.users.byUserNameIndex(user.userName.value)) : Promise.resolve(),
      user.userName ? this.cache.del(CacheKeys.users.usernameAlreadyExists(user.userName.value)) : Promise.resolve(),
    ]);
  }
}
