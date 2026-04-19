import { UserStatus } from '@/common/models/enums';
import { SessionMetadata } from '@/common/models/interfaces';

export interface GenerateTokenUseCaseInput {
  userId: string;
  email: string;
  status: UserStatus;
  sessionMetadata: SessionMetadata;
}

export interface GenerateTokenOutput {
  accessToken: string;
  refreshToken: string;
}
