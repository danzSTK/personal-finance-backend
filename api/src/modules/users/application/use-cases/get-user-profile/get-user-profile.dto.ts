import { User } from '@/modules/users/domain/entities/user.entity';

export interface GetUserProfileInput {
  user: User;
}

export interface GetUserProfileOutput {
  user: User;
  avatarUrl: string | null;
}
