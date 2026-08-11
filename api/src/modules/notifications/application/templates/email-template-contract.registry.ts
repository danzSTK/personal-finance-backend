import { EmailTemplateContractError } from '@/modules/notifications/application/errors/email-template-contract.error';
import {
  EmailTemplateKey,
  EmailTemplateParamsFor,
  EmailTemplateVersion,
  EmailTemplateVersionFor,
  EmailVerificationV1Params,
  PasswordChangeBlockedV1Params,
  PasswordChangedV1Params,
  WelcomeEmailV1Params,
} from '@/modules/notifications/domain/templates/email-template.contract';
import { z } from 'zod';

const nonBlankString = z
  .string()
  .min(1)
  .refine(value => value.trim().length > 0);

const webUrl = z.url().refine(value => {
  const protocol = new URL(value).protocol;

  return protocol === 'https:' || protocol === 'http:';
});

const brasiliaDateTime = z.string().regex(/^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/);

const welcomeEmailV1Schema: z.ZodType<WelcomeEmailV1Params> = z.strictObject({
  first_name: nonBlankString,
  dashboard_url: webUrl,
  support_url: webUrl,
  support_url_label: nonBlankString,
  preferences_url: webUrl,
});

const emailVerificationV1Schema: z.ZodType<EmailVerificationV1Params> = z.strictObject({
  first_name: nonBlankString,
  verification_url: webUrl,
  expires_in_minutes: z.number().int().positive(),
  support_url: webUrl,
});

const passwordChangedV1Schema: z.ZodType<PasswordChangedV1Params> = z.strictObject({
  first_name: nonBlankString,
  changed_at: brasiliaDateTime,
  ip_address: nonBlankString,
  location: nonBlankString,
  browser: nonBlankString,
  operating_system: nonBlankString,
  device: nonBlankString,
  support_url: webUrl,
});

const passwordChangeBlockedV1Schema: z.ZodType<PasswordChangeBlockedV1Params> = z.strictObject({
  first_name: nonBlankString,
  blocked_until: brasiliaDateTime,
  ip_address: nonBlankString,
  location: nonBlankString,
  browser: nonBlankString,
  operating_system: nonBlankString,
  device: nonBlankString,
  support_url: webUrl,
});

type RuntimeTemplateSchema = z.ZodType<Record<string, unknown>>;
interface RuntimeTemplateContract {
  schema: RuntimeTemplateSchema;
  parameterNames: ReadonlyArray<string>;
}
type RuntimeTemplateVersions = Readonly<Record<number, RuntimeTemplateContract>>;

const contractsByTemplate: Readonly<Record<string, RuntimeTemplateVersions>> = {
  [EmailTemplateKey.WELCOME]: {
    [EmailTemplateVersion.V1]: {
      schema: welcomeEmailV1Schema,
      parameterNames: ['first_name', 'dashboard_url', 'support_url', 'support_url_label', 'preferences_url'],
    },
  },
  [EmailTemplateKey.EMAIL_VERIFICATION]: {
    [EmailTemplateVersion.V1]: {
      schema: emailVerificationV1Schema,
      parameterNames: ['first_name', 'verification_url', 'expires_in_minutes', 'support_url'],
    },
  },
  [EmailTemplateKey.PASSWORD_CHANGED]: {
    [EmailTemplateVersion.V1]: {
      schema: passwordChangedV1Schema,
      parameterNames: [
        'first_name',
        'changed_at',
        'ip_address',
        'location',
        'browser',
        'operating_system',
        'device',
        'support_url',
      ],
    },
  },

  [EmailTemplateKey.PASSWORD_CHANGE_BLOCKED]: {
    [EmailTemplateVersion.V1]: {
      schema: passwordChangeBlockedV1Schema,
      parameterNames: [
        'first_name',
        'blocked_until',
        'ip_address',
        'location',
        'browser',
        'operating_system',
        'device',
        'support_url',
      ],
    },
  },
};

export interface EmailTemplateContractSummary {
  key: EmailTemplateKey;
  version: number;
  parameterNames: ReadonlyArray<string>;
}

export class EmailTemplateContractRegistry {
  static validate<TKey extends EmailTemplateKey, TVersion extends EmailTemplateVersionFor<TKey>>(
    templateKey: TKey,
    templateVersion: TVersion,
    params: EmailTemplateParamsFor<TKey, TVersion>,
  ): EmailTemplateParamsFor<TKey, TVersion> {
    return this.parse(templateKey, templateVersion, params) as EmailTemplateParamsFor<TKey, TVersion>;
  }

  static parse(templateKey: string, templateVersion: number, params: unknown): Record<string, unknown> {
    const versions = contractsByTemplate[templateKey];

    if (!versions) {
      throw EmailTemplateContractError.unknown(templateKey);
    }

    const contract = versions[templateVersion];

    if (!contract) {
      throw EmailTemplateContractError.versionUnsupported(templateKey, templateVersion);
    }

    const result = contract.schema.safeParse(params);

    if (!result.success) {
      throw EmailTemplateContractError.paramsInvalid(templateKey, templateVersion);
    }

    return result.data;
  }

  static list(): ReadonlyArray<EmailTemplateContractSummary> {
    return Object.entries(contractsByTemplate).flatMap(([key, versions]) =>
      Object.entries(versions).map(([version, contract]) => ({
        key: key as EmailTemplateKey,
        version: Number(version),
        parameterNames: contract.parameterNames,
      })),
    );
  }
}
