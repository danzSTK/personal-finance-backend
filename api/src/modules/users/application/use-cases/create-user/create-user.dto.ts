import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { User } from '@/modules/users/domain/entities/user.entity';

export interface CreateUserAuthProviderInput {
  provider: AuthProviderType;
  providerUserId: string;
  passwordHash: string | null;
}

export interface CreateUserUseCaseInput {
  userName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  status: UserStatus;
  authProviders?: CreateUserAuthProviderInput[];
}

export type CreateUserUseCaseOutput = User;
