import { User } from '@/modules/users/domain/entities/user.entity';

export abstract class IUserCacheInvalidator {
  abstract invalidate(user: User): Promise<void>;
}
