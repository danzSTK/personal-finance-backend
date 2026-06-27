import { User } from '@/modules/users/domain/entities/user.entity';

export interface UserCacheInvalidationContext {
  previousUserName?: string | null;
}

export abstract class IUserCacheInvalidator {
  abstract invalidate(user: User, context?: UserCacheInvalidationContext): Promise<void>;
}
