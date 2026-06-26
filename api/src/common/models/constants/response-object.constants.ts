export const RESPONSE_OBJECT_TYPES = {
  ACCOUNT_LIST: 'account.list',
  TRANSACTION_LIST: 'transaction.list',
  TRANSACTION_SUMMARY_TYPE: 'transaction_summary.type',
  TRANSACTION_SUMMARY_OVERVIEW: 'transaction_summary.overview',
} as const;

export type ResponseObjectType = (typeof RESPONSE_OBJECT_TYPES)[keyof typeof RESPONSE_OBJECT_TYPES];
