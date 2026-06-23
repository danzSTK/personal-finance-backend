import { InvalidStorageKeyError } from '@/modules/assets/domain/errors';
import { StorageKey } from '@/modules/assets/domain/value-objects/storage-key.value-object';

describe('StorageKey', () => {
  describe('create', () => {
    it('creates a normalized relative key', () => {
      const key = StorageKey.create('  users/user-id/avatars/asset-id.webp  ');

      expect(key.value).toBe('users/user-id/avatars/asset-id.webp');
    });

    it.each(['', '   ', '/users/user-id/avatar.webp'])(`rejects invalid key "%s"`, raw => {
      expect(() => StorageKey.create(raw)).toThrow(InvalidStorageKeyError);
    });

    it('rejects keys longer than the storage limit', () => {
      expect(() => StorageKey.create('a'.repeat(1025))).toThrow(InvalidStorageKeyError);
    });
  });
});
