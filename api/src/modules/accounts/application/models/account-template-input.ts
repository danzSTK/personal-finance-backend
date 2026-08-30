import { ColorToken, IconKey } from '@/common/models/enums';

export const ACCOUNT_TEMPLATE_INPUT_TYPE = {
  INSTITUTIONAL: 'institutional',
  CUSTOM: 'custom',
} as const;

export type AccountTemplateInputType = (typeof ACCOUNT_TEMPLATE_INPUT_TYPE)[keyof typeof ACCOUNT_TEMPLATE_INPUT_TYPE];

export interface InstitutionalAccountTemplateInput {
  type: typeof ACCOUNT_TEMPLATE_INPUT_TYPE.INSTITUTIONAL;
  templateId: string;
}

export interface CustomAccountTemplateInput {
  type: typeof ACCOUNT_TEMPLATE_INPUT_TYPE.CUSTOM;
  colorToken?: ColorToken | null;
  iconKey?: IconKey | null;
}

export type AccountTemplateInput = InstitutionalAccountTemplateInput | CustomAccountTemplateInput;
