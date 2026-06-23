import { ACCOUNT_NAME_MAX_LENGTH, ACCOUNT_NAME_MIN_LENGTH } from '@/common/models/constants';
import { InvalidAccountNameError } from '@/modules/accounts/domain/errors';

export class AccountName {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  static create(raw: string): AccountName {
    const normalized = raw.trim();

    if (!normalized) {
      throw new InvalidAccountNameError('Account name is required.');
    }

    if (normalized.length < ACCOUNT_NAME_MIN_LENGTH) {
      throw new InvalidAccountNameError('Account name is too short.');
    }

    if (normalized.length > ACCOUNT_NAME_MAX_LENGTH) {
      throw new InvalidAccountNameError('Account name is too long.');
    }

    return new AccountName(normalized);
  }

  static reconstitute(raw: string): AccountName {
    return new AccountName(raw);
  }

  equals(other: AccountName): boolean {
    return this._value === other.value;
  }
}
