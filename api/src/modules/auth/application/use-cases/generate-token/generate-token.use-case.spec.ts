/* eslint-disable @typescript-eslint/unbound-method */
import { UserStatus } from '@/common/models/enums';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { GenerateTokenUseCase } from '@/modules/auth/application/use-cases/generate-token/generate-token.use-case';
import { JwtService } from '@nestjs/jwt';

describe('GenerateTokenUseCase', () => {
  describe('execute', () => {
    it('embeds credentialVersion in both tokens and persists the refresh session', async () => {
      const sign = jest.fn().mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      const jwtService = { sign } as unknown as JwtService;
      const sessionRepository = {
        createSession: jest.fn(),
      } as unknown as jest.Mocked<ISessionRepository>;
      const useCase = new GenerateTokenUseCase(sessionRepository, jwtService, {
        accessSecret: 'a'.repeat(32),
        refreshSecret: 'b'.repeat(32),
        accessExpiresIn: '15m',
        refreshExpiresIn: '7d',
        issuer: 'https://api.example.com',
      });

      await expect(
        useCase.execute({
          userId: '70a2a29c-8195-48a0-87c1-5fe6b99ef24a',
          email: 'user@example.com',
          status: UserStatus.ACTIVE,
          credentialVersion: 4,
          sessionMetadata: {
            browser: 'Browser',
            os: 'OS',
            device: 'Desktop',
            ip: '203.0.113.10',
            location: 'Fortaleza',
            loginAt: '2026-07-30T12:00:00.000Z',
          },
        }),
      ).resolves.toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(sign).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          credentialVersion: 4,
        }),
        expect.any(Object),
      );
      expect(sign).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          credentialVersion: 4,
        }),
        expect.any(Object),
      );
      expect(sessionRepository.createSession).toHaveBeenCalledTimes(1);
    });
  });
});
