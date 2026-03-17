import { SessionMetadata } from '../../../../../common/models/interfaces';

export interface RefreshTokensUseCaseDto {
  userId: string;
  oldJti: string;
  sessionMetadata: SessionMetadata;
}
