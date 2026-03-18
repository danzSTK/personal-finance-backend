import { SessionMetadata } from '@/common/models/interfaces';

export interface LinkEmailProviderUseCaseDto {
  userId: string;
  email: string;
  password: string;
  sessionMetadata: SessionMetadata;
}
