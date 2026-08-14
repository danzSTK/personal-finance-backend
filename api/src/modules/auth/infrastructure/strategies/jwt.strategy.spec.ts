import { Email } from '@/common/domain/value-objects/email.value-object';
import { UserStatus } from '@/common/models/enums';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { JwtStrategy } from '@/modules/auth/infrastructure/strategies/jwt.strategy';
import { JwtPayloadDto } from '@/modules/auth/presentation/dto/jwt-payload.dto';
import { FindUserByIdUseCase } from '@/modules/users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

describe('JwtStrategy', () => {
  const userId = randomUUID();
  const payload: JwtPayloadDto = {
    sub: userId,
    jti: randomUUID(),
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    credentialVersion: 2,
  };
  const user = User.reconstitute(
    {
      userName: null,
      firstName: null,
      lastName: null,
      email: Email.reconstitute('user@example.com'),
      status: UserStatus.ACTIVE,
      avatarAssetId: null,
      authProviders: [],
      credentialVersion: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    userId,
  );
  let strategy: JwtStrategy;
  let request: AuthRequest;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    const findUserByIdUseCase = {
      execute: jest.fn().mockResolvedValue(user),
    } as unknown as FindUserByIdUseCase;
    userRepository = {
      findCredentialVersionById: jest.fn().mockResolvedValue(2),
    } as unknown as jest.Mocked<IUserRepository>;
    const sessionRepository = {
      isAccessTokenBlacklisted: jest.fn().mockResolvedValue(false),
    } as unknown as ISessionRepository;
    strategy = new JwtStrategy(findUserByIdUseCase, userRepository, sessionRepository, {
      accessSecret: 'a'.repeat(32),
      refreshSecret: 'b'.repeat(32),
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
      issuer: 'https://api.example.com',
    });
    request = {
      cookies: {},
    } as AuthRequest;
  });

  describe('validate', () => {
    it('accepts a matching credential version and attaches the verified payload', async () => {
      await expect(strategy.validate(request, payload)).resolves.toBe(user);
      expect(request.authToken).toBe(payload);
    });

    it('accepts a legacy token without the claim only while the database version is one', async () => {
      userRepository.findCredentialVersionById.mockResolvedValue(1);

      await expect(
        strategy.validate(request, {
          ...payload,
          credentialVersion: undefined,
        }),
      ).resolves.toBe(user);
    });

    it('rejects a token issued before the password change', async () => {
      userRepository.findCredentialVersionById.mockResolvedValue(3);

      await expect(strategy.validate(request, payload)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
