import { EmailVerificationPurpose } from '@/modules/auth/domain/constants/email-verification.constants';
import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import { InvalidEmailVerificationChallengeError } from '@/modules/auth/domain/errors/invalid-email-verification-challenge.error';

const createChallenge = (email = 'daniel@example.com'): EmailVerificationChallenge =>
  EmailVerificationChallenge.create(
    {
      userId: 'user-1',
      email,
      purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
    'challenge-1',
  );

const makeChallenge = (): EmailVerificationChallenge =>
  EmailVerificationChallenge.reconstitute(
    {
      userId: 'user-1',
      email: 'daniel@example.com',
      purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2026-01-01T10:15:00.000Z'),
      consumedAt: null,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
    },
    'challenge-1',
  );

describe('EmailVerificationChallenge', () => {
  describe('create', () => {
    it('normalizes email using the platform email rules', () => {
      const challenge = createChallenge(' Daniel@Example.COM ');

      expect(challenge.email).toBe('daniel@example.com');
    });

    it('rejects invalid email using the platform email rules', () => {
      expect(() => createChallenge('invalid-email')).toThrow(InvalidEmailVerificationChallengeError);
    });

    it('rejects emails longer than the platform limit', () => {
      const longEmail = `${'a'.repeat(250)}@x.com`;

      expect(() => createChallenge(longEmail)).toThrow(InvalidEmailVerificationChallengeError);
    });
  });

  describe('consume', () => {
    it('marks the challenge as consumed', () => {
      const challenge = makeChallenge();
      const consumedAt = new Date('2026-01-01T10:05:00.000Z');

      challenge.consume(consumedAt);

      expect(challenge.consumedAt).toBe(consumedAt);
      expect(challenge.isConsumed).toBe(true);
    });

    it('rejects consuming an expired challenge', () => {
      const challenge = makeChallenge();

      expect(() => challenge.consume(new Date('2026-01-01T10:16:00.000Z'))).toThrow(
        InvalidEmailVerificationChallengeError,
      );
    });
  });
});
