import { User } from '@/modules/users/domain/entities/user.entity';

export interface UpdateUserProfileInput {
  user: User;
  firstName?: string | null;
  lastName?: string | null;
}

export type UpdateUserProfileOutput = User;
