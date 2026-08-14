import { UserStatus } from '@/common/models/enums';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { JwtRefreshStrategy } from '@/modules/auth/infrastructure/strategies/jwt-refresh.strategy';
import { JwtPayloadDto } from '@/modules/auth/presentation/dto/jwt-payload.dto';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

describe('JwtRefreshStrategy', () => {
  const userId = randomUUID();
  const jti = randomUUID();
  const payload: JwtPayloadDto = {
    sub: userId,
    jti,
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    credentialVersion: 2,
  };
  let strategy: JwtRefreshStrategy;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    const sessionRepository = {
      getSession: jest.fn().mockResolvedValue({
        browser: 'Browser',
      }),
    } as unknown as ISessionRepository;
    userRepository = {
      findCredentialVersionById: jest.fn().mockResolvedValue(2),
    } as unknown as jest.Mocked<IUserRepository>;
    strategy = new JwtRefreshStrategy(
      {
        accessSecret: 'a'.repeat(32),
        refreshSecret: 'b'.repeat(32),
        accessExpiresIn: '15m',
        refreshExpiresIn: '7d',
        issuer: 'https://api.example.com',
      },
      sessionRepository,
      userRepository,
    );
  });

  describe('validate', () => {
    it('returns the rotation context for a current token', async () => {
      await expect(strategy.validate(payload)).resolves.toEqual({
        id: userId,
        oldRefreshTokenJti: jti,
      });
    });

    it('rejects a refresh token issued before the password change', async () => {
      userRepository.findCredentialVersionById.mockResolvedValue(3);

      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
