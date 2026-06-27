import { User } from '@/modules/users/domain/entities/user.entity';

export interface UpdateUsernameUseCaseInput {
  userId: string;
  newUsername: string;
}

export type UpdateUsernameUseCaseOutput = User;
