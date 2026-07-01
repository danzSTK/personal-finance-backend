import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { EmailVerificationPurpose } from '@/modules/auth/domain/constants/email-verification.constants';
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

  abstract findLatestByEmailAndPurpose(
    email: string,
    purpose: EmailVerificationPurpose,
    options?: IRepositoryOptions,
  ): Promise<EmailVerificationChallenge | null>;

  abstract countByEmailAndPurposeSince(
    email: string,
    purpose: EmailVerificationPurpose,
    since: Date,
    options?: IRepositoryOptions,
  ): Promise<number>;

  abstract save(
    challenge: EmailVerificationChallenge,
    options?: IRepositoryOptions,
  ): Promise<EmailVerificationChallenge>;
}
