import { SessionMetadata } from '../../../../../common/models/interfaces';

export interface RefreshTokensUseCaseInput {
  userId: string;
  oldJti: string;
  sessionMetadata: SessionMetadata;
}

export interface RefreshTokenUseCaseOutput {
  accessToken: string;
  refreshToken: string;
}
