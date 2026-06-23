import { InvalidStorageKeyError } from '@/modules/assets/domain/errors';

const STORAGE_KEY_MAX_LENGTH = 1024;

export class StorageKey {
  private constructor(private readonly _value: string) {}

  get value(): string {
    return this._value;
  }

  static create(raw: string): StorageKey {
    const normalized = raw.trim();

    if (!normalized) {
      throw new InvalidStorageKeyError('Storage key is required.');
    }

    if (normalized.startsWith('/')) {
      throw new InvalidStorageKeyError('Storage key must be relative.');
    }

    if (normalized.length > STORAGE_KEY_MAX_LENGTH) {
      throw new InvalidStorageKeyError(`Storage key must be at most ${STORAGE_KEY_MAX_LENGTH} characters long.`);
    }

    return new StorageKey(normalized);
  }

  static reconstitute(raw: string): StorageKey {
    return new StorageKey(raw);
  }

  equals(other: StorageKey): boolean {
    return this._value === other.value;
  }

  toString(): string {
    return this._value;
  }
}
