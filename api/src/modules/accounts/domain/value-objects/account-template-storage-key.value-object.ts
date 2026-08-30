import { InvalidAccountTemplateError } from '@/modules/accounts/domain/errors';

const ACCOUNT_TEMPLATE_STORAGE_KEY_MAX_LENGTH = 1024;

export class AccountTemplateStorageKey {
  private constructor(private readonly key: string) {}

  get value(): string {
    return this.key;
  }

  static create(value: string): AccountTemplateStorageKey {
    if (
      value.trim() === '' ||
      value.length > ACCOUNT_TEMPLATE_STORAGE_KEY_MAX_LENGTH ||
      value.startsWith('/') ||
      value.includes('..') ||
      value.includes('\\')
    ) {
      throw new InvalidAccountTemplateError('Invalid account template storage key.');
    }

    return new AccountTemplateStorageKey(value);
  }

  static reconstitute(value: string): AccountTemplateStorageKey {
    return new AccountTemplateStorageKey(value);
  }

  equals(other: AccountTemplateStorageKey): boolean {
    return this.key === other.key;
  }
}
