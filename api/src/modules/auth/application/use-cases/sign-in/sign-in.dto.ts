import { UserStatus } from '../../../../../common/models/enums';
import { SessionMetadata } from '../../../../../common/models/interfaces';

export interface SignInUseCaseInput {
  userId: string;
  email: string;
  status: UserStatus;
  sessionMetadata: SessionMetadata;
}

export interface SignInUseCaseOutput {
  accessToken: string;
  refreshToken: string;
}
