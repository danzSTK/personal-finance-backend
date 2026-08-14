export const EmailMessageStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED_RETRYABLE: 'FAILED_RETRYABLE',
  FAILED_PERMANENT: 'FAILED_PERMANENT',
  CANCELED: 'CANCELED',
} as const;

export type EmailMessageStatus = (typeof EmailMessageStatus)[keyof typeof EmailMessageStatus];

export const EmailMessageType = {
  WELCOME: 'WELCOME',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_CHANGE_BLOCKED: 'PASSWORD_CHANGE_BLOCKED',
} as const;

export type EmailMessageType = (typeof EmailMessageType)[keyof typeof EmailMessageType];

export const EmailMessageLimits = {
  recipientEmailMaxLength: 320,
  recipientNameMaxLength: 120,
  providerMaxLength: 50,
  templateKeyMaxLength: 100,
  idempotencyKeyMaxLength: 255,
  statusMaxLength: 30,
  providerMessageIdMaxLength: 255,
  lastErrorCodeMaxLength: 100,
  lastErrorMessageMaxLength: 2_000,
} as const;

export const WelcomeEmailIdempotencyKeys = {
  user: (userId: string): string => `email:welcome:user:${userId}`,
} as const;

export const EmailVerificationIdempotencyKeys = {
  challenge: (challengeId: string): string => `email:verification:challenge:${challengeId}`,
} as const;

export const PasswordChangedEmailIdempotencyKeys = {
  event: (sourceEventId: string): string => `email:password-change:event:${sourceEventId}`,
} as const;

export const PasswordChangeBlockedEmailIdempotencyKeys = {
  event: (sourceEventId: string): string => `email:password-change:event:${sourceEventId}`,
} as const;
