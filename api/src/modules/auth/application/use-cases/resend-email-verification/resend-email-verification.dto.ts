import { EmailVerificationResendStatus } from '@/modules/auth/domain/constants/email-verification.constants';

export interface ResendEmailVerificationUseCaseInput {
  userId: string;
}

export interface ResendEmailVerificationUseCaseOutput {
  status: typeof EmailVerificationResendStatus.QUEUED | typeof EmailVerificationResendStatus.ALREADY_VERIFIED;
}
