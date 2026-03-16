import { UserStatus } from '../../../../../common/models/enums';
import { SessionMetadata } from '../../../../../common/models/interfaces';

export interface GenerateTokenUseCaseDto {
  userId: string;
  email: string;
  status: UserStatus;
  sessionMetadata: SessionMetadata;
}

export interface GenerateTokenResult {
  accessToken: string;
  refreshToken: string;
}
