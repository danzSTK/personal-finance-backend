export const RESPONSE_OBJECT_TYPES = {
  ACCOUNT_ITEM: 'account.item',
  ACCOUNT_LIST: 'account.list',
  ACCOUNT_TEMPLATE_ITEM: 'account_template.item',
  ACCOUNT_SUMMARY: 'account.summary',
  TRANSACTION_LIST: 'transaction.list',
  TRANSACTION_SUMMARY_TYPE: 'transaction_summary.type',
  TRANSACTION_SUMMARY_OVERVIEW: 'transaction_summary.overview',
  EMAIL_VERIFICATION_CONFIRMATION: 'email_verification.confirmation',
  EMAIL_VERIFICATION_RESEND: 'email_verification.resend',
  EMAIL_VERIFICATION_RESEND_STATUS_AVAILABLE: 'email_verification.resend_status.available',
  EMAIL_VERIFICATION_RESEND_STATUS_BLOCKED: 'email_verification.resend_status.blocked',
  EMAIL_VERIFICATION_RESEND_STATUS_ALREADY_VERIFIED: 'email_verification.resend_status.already_verified',
  AUTH_PASSWORD_CHANGE: 'auth.password_change',
  AUTH_PASSWORD_CHANGE_STATUS: 'auth.password_change_status',
  AUTH_PROVIDER_EMAIL_LINK: 'auth_provider.email_link',
} as const;

export type ResponseObjectType = (typeof RESPONSE_OBJECT_TYPES)[keyof typeof RESPONSE_OBJECT_TYPES];
