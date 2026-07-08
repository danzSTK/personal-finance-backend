export const RESPONSE_OBJECT_TYPES = {
  ACCOUNT_LIST: 'account.list',
  ACCOUNT_SUMMARY: 'account.summary',
  TRANSACTION_LIST: 'transaction.list',
  TRANSACTION_SUMMARY_TYPE: 'transaction_summary.type',
  TRANSACTION_SUMMARY_OVERVIEW: 'transaction_summary.overview',
  EMAIL_VERIFICATION_CONFIRMATION: 'email_verification.confirmation',
  EMAIL_VERIFICATION_RESEND: 'email_verification.resend',
} as const;

export type ResponseObjectType = (typeof RESPONSE_OBJECT_TYPES)[keyof typeof RESPONSE_OBJECT_TYPES];
