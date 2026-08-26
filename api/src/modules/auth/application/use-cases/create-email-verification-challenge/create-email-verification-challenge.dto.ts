import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import { NewEmailVerificationChallengeOrigin } from '@/modules/auth/domain/constants/email-verification.constants';

export interface CreateEmailVerificationChallengeUseCaseInput {
  userId: string;
  email: string;
  origin: NewEmailVerificationChallengeOrigin;
  now?: Date;
  options?: IRepositoryOptions;
}

export interface CreateEmailVerificationChallengeUseCaseOutput {
  challenge: EmailVerificationChallenge;
  token: string | null;
  created: boolean;
}
