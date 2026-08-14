import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { RedisService } from '@/database/redis/redis.service';
import { PasswordChangeCostLimitedError } from '@/modules/auth/application/errors/password-change-cost-limit.error';
import { PasswordChangeCostGuard } from '@/modules/auth/presentation/guards/password-change-cost.guard';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

describe('PasswordChangeCostGuard', () => {
  const evalMock = jest.fn();
  const redis = {
    getClient: () => ({
      eval: evalMock,
    }),
  } as unknown as RedisService;
  const config = {
    getOrThrow: jest.fn().mockReturnValue('hmac-secret-with-at-least-thirty-two-characters'),
  } as unknown as ConfigService;
  const guard = new PasswordChangeCostGuard(redis, config);
  const request = {
    authToken: {
      jti: randomUUID(),
      sub: randomUUID(),
    },
    ip: '203.0.113.10',
    headers: {},
    socket: {
      remoteAddress: '203.0.113.10',
    },
  } as AuthRequest;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('allows requests below both technical limits', async () => {
      evalMock.mockResolvedValue([1, 60_000, 1, 60_000]);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      const call = evalMock.mock.calls[0] as unknown[];
      const keys = call.slice(2, 4).map(value => String(value));
      expect(keys.every(key => !key.includes(request.ip!))).toBe(true);
      expect(keys.every(key => !key.includes(request.authToken!.jti))).toBe(true);
    });

    it('rejects a session above its limit with the remaining TTL', async () => {
      evalMock.mockResolvedValue([1, 60_000, 7, 31_001]);

      await expect(guard.canActivate(context)).rejects.toMatchObject<Partial<PasswordChangeCostLimitedError>>({
        retryAfterSeconds: 32,
      });
    });

    it('fails open when only the technical Redis limiter is unavailable', async () => {
      evalMock.mockRejectedValue(new Error('redis unavailable'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('rejects requests without a verified session context', async () => {
      const missingSessionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            ...request,
            authToken: undefined,
          }),
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(missingSessionContext)).resolves.toBe(false);
      expect(evalMock).not.toHaveBeenCalled();
    });
  });
});
