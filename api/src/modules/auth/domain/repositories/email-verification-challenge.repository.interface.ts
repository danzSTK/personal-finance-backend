import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import {
  EmailVerificationChallengeOrigin,
  EmailVerificationPurpose,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';

export abstract class IEmailVerificationChallengeRepository {
  abstract findByTokenHash(
    purpose: EmailVerificationPurpose,
    tokenHash: string,
    options?: IRepositoryOptions,
  ): Promise<EmailVerificationChallenge | null>;

  abstract findByTokenHashForUpdate(
    purpose: EmailVerificationPurpose,
    tokenHash: string,
    options: Required<IRepositoryOptions>,
  ): Promise<EmailVerificationChallenge | null>;

  abstract findByUserIdPurposeAndOrigin(
    userId: string,
    purpose: EmailVerificationPurpose,
    origin: EmailVerificationChallengeOrigin,
    options?: IRepositoryOptions,
  ): Promise<EmailVerificationChallenge | null>;

  abstract saveAutomaticIfAbsent(
    challenge: EmailVerificationChallenge,
    options?: IRepositoryOptions,
  ): Promise<{ challenge: EmailVerificationChallenge; created: boolean }>;

  abstract save(
    challenge: EmailVerificationChallenge,
    options?: IRepositoryOptions,
  ): Promise<EmailVerificationChallenge>;
}
