import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';

export type CreateEmailVerificationChallengeMode = 'automatic' | 'resend';

export interface CreateEmailVerificationChallengeUseCaseInput {
  userId: string;
  email: string;
  mode: CreateEmailVerificationChallengeMode;
  options?: IRepositoryOptions;
}

export interface CreateEmailVerificationChallengeUseCaseOutput {
  challenge: EmailVerificationChallenge;
  token: string | null;
  created: boolean;
}
