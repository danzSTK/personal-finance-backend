export const EmailVerificationPurpose = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
} as const;

export type EmailVerificationPurpose = (typeof EmailVerificationPurpose)[keyof typeof EmailVerificationPurpose];

export const EmailVerificationChallengeOrigin = {
  AUTOMATIC: 'AUTOMATIC',
  MANUAL_RESEND: 'MANUAL_RESEND',
  LEGACY_UNKNOWN: 'LEGACY_UNKNOWN',
} as const;

export type EmailVerificationChallengeOrigin =
  (typeof EmailVerificationChallengeOrigin)[keyof typeof EmailVerificationChallengeOrigin];

export type NewEmailVerificationChallengeOrigin = Exclude<
  EmailVerificationChallengeOrigin,
  typeof EmailVerificationChallengeOrigin.LEGACY_UNKNOWN
>;

export const EmailVerificationResendRestriction = {
  COOLDOWN: 'COOLDOWN',
  DAILY_LIMIT: 'DAILY_LIMIT',
  OPERATION_PENDING: 'OPERATION_PENDING',
} as const;

export type EmailVerificationResendRestriction =
  (typeof EmailVerificationResendRestriction)[keyof typeof EmailVerificationResendRestriction];

export const EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT = 5;
export const EMAIL_VERIFICATION_MANUAL_RESEND_WINDOW_SECONDS = 86_400;
export const EMAIL_VERIFICATION_INITIAL_COOLDOWN_SECONDS = 60;
export const EMAIL_VERIFICATION_MAX_COOLDOWN_SECONDS = 600;
export const EMAIL_VERIFICATION_MINIMUM_USABLE_TOKEN_SECONDS = 300;
export const EMAIL_VERIFICATION_MUTATION_TTL_SECONDS = 30;

export const EmailVerificationChallengeLimits = {
  purposeMaxLength: 50,
  originMaxLength: 30,
  tokenHashLength: 64,
} as const;
