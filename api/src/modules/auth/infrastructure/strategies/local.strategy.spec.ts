import { PasswordByteLimitExceededError } from '@/common/domain/errors';
import { ValidateCredentialsUseCase } from '@/modules/auth/application/use-cases/validate-credentials/validate-credentials.use-case';
import { LocalStrategy } from '@/modules/auth/infrastructure/strategies/local.strategy';
import { User } from '@/modules/users/domain/entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let validateCredentialsUseCase: jest.Mocked<ValidateCredentialsUseCase>;

  beforeEach(() => {
    jest.clearAllMocks();
    validateCredentialsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ValidateCredentialsUseCase>;
    strategy = new LocalStrategy(validateCredentialsUseCase);
  });

  describe('validate', () => {
    it('returns the authenticated user', async () => {
      const user = {} as User;
      validateCredentialsUseCase.execute.mockResolvedValue(user);

      await expect(strategy.validate('user@example.com', 'valid-password')).resolves.toBe(user);
    });

    it('returns the generic unauthorized error when credentials do not match', async () => {
      validateCredentialsUseCase.execute.mockResolvedValue(null);

      await expect(strategy.validate('user@example.com', 'invalid-password')).rejects.toMatchObject({
        status: 401,
        message: 'Invalid credentials',
      });
    });

    it('converts only the password byte-limit error to generic unauthorized', async () => {
      validateCredentialsUseCase.execute.mockRejectedValue(new PasswordByteLimitExceededError());

      const result = strategy.validate('user@example.com', `${'é'.repeat(36)}a`);

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(result).rejects.toMatchObject({
        status: 401,
        message: 'Invalid credentials',
      });
    });

    it('propagates unexpected errors', async () => {
      const unexpectedError = new Error('database unavailable');
      validateCredentialsUseCase.execute.mockRejectedValue(unexpectedError);

      await expect(strategy.validate('user@example.com', 'valid-password')).rejects.toBe(unexpectedError);
    });
  });
});
