import { ACCOUNT_COLOR_TOKEN_MAX_LENGTH, isColorToken } from '@/common/models/constants';
import { ColorToken } from '@/common/models/enums';
import { InvalidAccountTemplateError } from '@/modules/accounts/domain/errors';

export const INSTITUTIONAL_ACCOUNT_TEMPLATE_COLOR_TOKENS = [
  'nubank',
  'inter',
  'itau',
  'bradesco',
  'santander',
  'banco-do-brasil',
  'caixa',
  'c6',
  'picpay',
  'mercado-pago',
] as const;

export type InstitutionalAccountTemplateColorToken = (typeof INSTITUTIONAL_ACCOUNT_TEMPLATE_COLOR_TOKENS)[number];
export type AccountTemplateColorTokenValue = ColorToken | InstitutionalAccountTemplateColorToken;

export function isInstitutionalAccountTemplateColorToken(
  value: string,
): value is InstitutionalAccountTemplateColorToken {
  return INSTITUTIONAL_ACCOUNT_TEMPLATE_COLOR_TOKENS.includes(value as InstitutionalAccountTemplateColorToken);
}

export class AccountTemplateColorToken {
  private constructor(private readonly token: AccountTemplateColorTokenValue) {}

  get value(): AccountTemplateColorTokenValue {
    return this.token;
  }

  static create(value: string): AccountTemplateColorToken {
    if (
      value.trim() === '' ||
      value.length > ACCOUNT_COLOR_TOKEN_MAX_LENGTH ||
      (!isColorToken(value) && !isInstitutionalAccountTemplateColorToken(value))
    ) {
      throw new InvalidAccountTemplateError('Invalid account template color token.');
    }

    return new AccountTemplateColorToken(value);
  }

  static reconstitute(value: AccountTemplateColorTokenValue): AccountTemplateColorToken {
    return new AccountTemplateColorToken(value);
  }

  equals(other: AccountTemplateColorToken): boolean {
    return this.token === other.token;
  }
}
