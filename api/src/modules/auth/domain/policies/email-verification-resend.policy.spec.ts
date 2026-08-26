import {
  EmailVerificationChallengeOrigin,
  EmailVerificationResendRestriction,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { EmailVerificationResendPolicy } from '@/modules/auth/domain/policies/email-verification-resend.policy';

describe('EmailVerificationResendPolicy', () => {
  let policy: EmailVerificationResendPolicy;

  beforeEach(() => {
    policy = new EmailVerificationResendPolicy();
    jest.clearAllMocks();
  });

  describe('cooldownSecondsAfterSend', () => {
    it('uses 60 seconds for automatic and the capped exponential sequence for manual sends', () => {
      expect(policy.cooldownSecondsAfterSend(EmailVerificationChallengeOrigin.AUTOMATIC, 0)).toBe(60);
      expect(
        [1, 2, 3, 4, 5].map(manualCount =>
          policy.cooldownSecondsAfterSend(EmailVerificationChallengeOrigin.MANUAL_RESEND, manualCount),
        ),
      ).toEqual([120, 240, 480, 600, 600]);
    });
  });

  describe('evaluateRestrictions', () => {
    it('allows an operation below the manual limit without active restrictions', () => {
      expect(policy.evaluateRestrictions(4, [])).toEqual({ allowed: true });
    });

    it('selects the longest retry and uses deterministic precedence on ties', () => {
      expect(
        policy.evaluateRestrictions(2, [
          { blockedBy: EmailVerificationResendRestriction.COOLDOWN, retryAfterSeconds: 60 },
          { blockedBy: EmailVerificationResendRestriction.OPERATION_PENDING, retryAfterSeconds: 60 },
          { blockedBy: EmailVerificationResendRestriction.DAILY_LIMIT, retryAfterSeconds: 20 },
        ]),
      ).toEqual({
        allowed: false,
        blockedBy: EmailVerificationResendRestriction.OPERATION_PENDING,
        retryAfterSeconds: 60,
      });
    });
  });
});
