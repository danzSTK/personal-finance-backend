import {
  EMAIL_VERIFICATION_INITIAL_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT,
  EMAIL_VERIFICATION_MAX_COOLDOWN_SECONDS,
  EmailVerificationChallengeOrigin,
  EmailVerificationResendRestriction,
  NewEmailVerificationChallengeOrigin,
} from '@/modules/auth/domain/constants/email-verification.constants';

export interface EmailVerificationResendRestrictionCandidate {
  readonly blockedBy: EmailVerificationResendRestriction;
  readonly retryAfterSeconds: number;
}

export type EmailVerificationResendPolicyResult =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly blockedBy: EmailVerificationResendRestriction;
      readonly retryAfterSeconds: number;
    };

export class EmailVerificationResendPolicy {
  cooldownSecondsAfterSend(origin: NewEmailVerificationChallengeOrigin, manualResendsUsed: number): number {
    if (origin === EmailVerificationChallengeOrigin.AUTOMATIC) {
      return EMAIL_VERIFICATION_INITIAL_COOLDOWN_SECONDS;
    }

    const normalizedManualCount = Math.max(0, Math.trunc(manualResendsUsed));

    return Math.min(
      EMAIL_VERIFICATION_INITIAL_COOLDOWN_SECONDS * 2 ** normalizedManualCount,
      EMAIL_VERIFICATION_MAX_COOLDOWN_SECONDS,
    );
  }

  evaluateRestrictions(
    manualResendsUsed: number,
    candidates: ReadonlyArray<EmailVerificationResendRestrictionCandidate>,
  ): EmailVerificationResendPolicyResult {
    const activeCandidates = candidates.filter(candidate => candidate.retryAfterSeconds > 0);

    if (manualResendsUsed < EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT && activeCandidates.length === 0) {
      return { allowed: true };
    }

    const dailyLimitFallback: EmailVerificationResendRestrictionCandidate = {
      blockedBy: EmailVerificationResendRestriction.DAILY_LIMIT,
      retryAfterSeconds: 1,
    };
    const effectiveCandidates =
      manualResendsUsed >= EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT
        ? [...activeCandidates, dailyLimitFallback]
        : activeCandidates;
    const restriction = effectiveCandidates.reduce((current, candidate) =>
      this.isPreferred(candidate, current) ? candidate : current,
    );

    return {
      allowed: false,
      blockedBy: restriction.blockedBy,
      retryAfterSeconds: Math.max(1, Math.ceil(restriction.retryAfterSeconds)),
    };
  }

  private isPreferred(
    candidate: EmailVerificationResendRestrictionCandidate,
    current: EmailVerificationResendRestrictionCandidate,
  ): boolean {
    if (candidate.retryAfterSeconds !== current.retryAfterSeconds) {
      return candidate.retryAfterSeconds > current.retryAfterSeconds;
    }

    return this.precedence(candidate.blockedBy) > this.precedence(current.blockedBy);
  }

  private precedence(restriction: EmailVerificationResendRestriction): number {
    switch (restriction) {
      case EmailVerificationResendRestriction.OPERATION_PENDING:
        return 3;
      case EmailVerificationResendRestriction.DAILY_LIMIT:
        return 2;
      case EmailVerificationResendRestriction.COOLDOWN:
        return 1;
    }
  }
}
