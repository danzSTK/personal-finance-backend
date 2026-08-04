export const EmailTemplateKey = {
  WELCOME: 'welcome-email',
  EMAIL_VERIFICATION: 'email-verification',
} as const;

export type EmailTemplateKey = (typeof EmailTemplateKey)[keyof typeof EmailTemplateKey];

export const EmailTemplateVersion = {
  V1: 1,
} as const;

export interface WelcomeEmailV1Params extends Record<string, unknown> {
  first_name: string;
  dashboard_url: string;
  support_url: string;
  support_url_label: string;
  preferences_url: string;
}

export interface EmailVerificationV1Params extends Record<string, unknown> {
  first_name: string;
  verification_url: string;
  expires_in_minutes: number;
  support_url: string;
}

export interface EmailTemplateParamsMap {
  [EmailTemplateKey.WELCOME]: {
    1: WelcomeEmailV1Params;
  };
  [EmailTemplateKey.EMAIL_VERIFICATION]: {
    1: EmailVerificationV1Params;
  };
}

export type EmailTemplateVersionFor<TKey extends EmailTemplateKey> = Extract<
  keyof EmailTemplateParamsMap[TKey],
  number
>;

export type EmailTemplateParamsFor<
  TKey extends EmailTemplateKey,
  TVersion extends EmailTemplateVersionFor<TKey>,
> = EmailTemplateParamsMap[TKey][TVersion];

export interface EmailTemplateReference<
  TKey extends EmailTemplateKey = EmailTemplateKey,
  TVersion extends number = number,
> {
  key: TKey;
  version: TVersion;
}

export const ActiveEmailTemplateVersion = {
  [EmailTemplateKey.WELCOME]: EmailTemplateVersion.V1,
  [EmailTemplateKey.EMAIL_VERIFICATION]: EmailTemplateVersion.V1,
} as const satisfies {
  [TKey in EmailTemplateKey]: EmailTemplateVersionFor<TKey>;
};
