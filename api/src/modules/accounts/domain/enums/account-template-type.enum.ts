export const ACCOUNT_TEMPLATE_TYPE = {
  INSTITUTIONAL: 'INSTITUTIONAL',
  CUSTOM: 'CUSTOM',
} as const;

export type AccountTemplateType = (typeof ACCOUNT_TEMPLATE_TYPE)[keyof typeof ACCOUNT_TEMPLATE_TYPE];

export function isAccountTemplateType(value: string): value is AccountTemplateType {
  return Object.values(ACCOUNT_TEMPLATE_TYPE).includes(value as AccountTemplateType);
}
