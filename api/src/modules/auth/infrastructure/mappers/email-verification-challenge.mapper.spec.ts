import {
  EmailVerificationChallengeOrigin,
  EmailVerificationPurpose,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import { EmailVerificationChallengeMapper } from '@/modules/auth/infrastructure/mappers/email-verification-challenge.mapper';
import { EmailVerificationChallengeOrmEntity } from '@/modules/auth/infrastructure/persistence/email-verification-challenge-orm.entity';

describe('EmailVerificationChallengeMapper', () => {
  const ormEntity = {
    id: 'challenge-1',
    userId: 'user-1',
    email: 'daniel@example.com',
    purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
    origin: EmailVerificationChallengeOrigin.LEGACY_UNKNOWN,
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date('2026-08-26T00:15:00.000Z'),
    consumedAt: null,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
  } as EmailVerificationChallengeOrmEntity;

  it('rehydrates the persisted origin without applying creation-only restrictions', () => {
    const challenge = EmailVerificationChallengeMapper.toDomain(ormEntity);

    expect(challenge.origin).toBe(EmailVerificationChallengeOrigin.LEGACY_UNKNOWN);
    expect(challenge.createdAt).toEqual(ormEntity.createdAt);
  });

  it('persists the current challenge origin', () => {
    const challenge = EmailVerificationChallenge.create(
      {
        userId: 'user-1',
        email: 'daniel@example.com',
        purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
        origin: EmailVerificationChallengeOrigin.MANUAL_RESEND,
        tokenHash: 'b'.repeat(64),
        expiresAt: new Date(Date.now() + 15 * 60 * 1_000),
      },
      'challenge-2',
    );

    expect(EmailVerificationChallengeMapper.toOrm(challenge)).toMatchObject({
      id: 'challenge-2',
      origin: EmailVerificationChallengeOrigin.MANUAL_RESEND,
    });
  });
});
