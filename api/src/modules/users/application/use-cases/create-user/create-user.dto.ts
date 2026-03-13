import { AuthProviderType, UserStatus } from '../../../../../common/models/enums';

export interface CreateUserAuthProviderInput {
  provider: AuthProviderType;
  providerUserId: string;
  passwordHash: string | null;
}

export interface CreateUserUseCaseDto {
  userName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  status: UserStatus;
  authProviders?: CreateUserAuthProviderInput[];
}
