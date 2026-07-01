export const EmailVerificationPurpose = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
} as const;

export type EmailVerificationPurpose = (typeof EmailVerificationPurpose)[keyof typeof EmailVerificationPurpose];

export const EmailVerificationChallengeLimits = {
  emailMaxLength: 320,
  purposeMaxLength: 50,
  tokenHashLength: 64,
} as const;
