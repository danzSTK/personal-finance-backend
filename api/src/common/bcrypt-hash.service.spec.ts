import { BcryptHashService } from '@/common/bcrypt-hash.service';
import { PasswordByteLimitExceededError } from '@/common/domain/errors';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('BcryptHashService', () => {
  const encrypted = '$2b$10$encrypted';
  const passwordAtLimit = 'é'.repeat(36);
  const passwordAboveLimit = `${passwordAtLimit}a`;
  let service: BcryptHashService;
  let hashMock: jest.Mock;
  let compareMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BcryptHashService();
    hashMock = bcrypt.hash as unknown as jest.Mock;
    compareMock = bcrypt.compare as unknown as jest.Mock;
    hashMock.mockResolvedValue(encrypted);
    compareMock.mockResolvedValue(true);
  });

  describe('hash', () => {
    it('passes a password with exactly 72 UTF-8 bytes to bcrypt', async () => {
      await expect(service.hash(passwordAtLimit)).resolves.toBe(encrypted);

      expect(hashMock).toHaveBeenCalledWith(passwordAtLimit, 10);
    });

    it('rejects a password above 72 UTF-8 bytes before bcrypt', async () => {
      await expect(service.hash(passwordAboveLimit)).rejects.toMatchObject({
        code: 'PASSWORD_BYTE_LIMIT_EXCEEDED',
      });
      expect(hashMock).not.toHaveBeenCalled();
    });
  });

  describe('compare', () => {
    it('passes a password with exactly 72 UTF-8 bytes to bcrypt', async () => {
      await expect(service.compare(passwordAtLimit, encrypted)).resolves.toBe(true);

      expect(compareMock).toHaveBeenCalledWith(passwordAtLimit, encrypted);
    });

    it('rejects a password above 72 UTF-8 bytes before bcrypt', async () => {
      await expect(service.compare(passwordAboveLimit, encrypted)).rejects.toBeInstanceOf(
        PasswordByteLimitExceededError,
      );
      expect(compareMock).not.toHaveBeenCalled();
    });
  });
});
