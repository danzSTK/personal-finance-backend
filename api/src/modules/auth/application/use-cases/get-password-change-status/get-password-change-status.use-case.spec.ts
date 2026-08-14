/* eslint-disable @typescript-eslint/unbound-method */
import { PasswordChangeOperationPendingError } from '@/modules/auth/application/errors/password-change-operation-pending.error';
import { PasswordChangeStateUnavailableError } from '@/modules/auth/application/errors/password-change-state-unavailable.error';
import { PasswordChangeStateLoader } from '@/modules/auth/application/services/password-change-state-loader';
import { GetPasswordChangeStatusUseCase } from '@/modules/auth/application/use-cases/get-password-change-status/get-password-change-status.use-case';
import { ChangePasswordPolicy } from '@/modules/auth/domain/policies/change-password.policy';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

describe('GetPasswordChangeStatusUseCase', () => {
  const now = new Date('2026-08-13T12:00:00.000Z');
  let useCase: GetPasswordChangeStatusUseCase;
  let stateLoader: jest.Mocked<PasswordChangeStateLoader>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(now);

    stateLoader = {
      load: jest.fn(),
    } as unknown as jest.Mocked<PasswordChangeStateLoader>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetPasswordChangeStatusUseCase,
        ChangePasswordPolicy,
        { provide: PasswordChangeStateLoader, useValue: stateLoader },
      ],
    }).compile();

    useCase = moduleRef.get(GetPasswordChangeStatusUseCase);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('execute', () => {
    it('returns true when the operational state has no restriction', async () => {
      const userId = randomUUID();
      stateLoader.load.mockResolvedValue({
        state: {
          blockedUntil: null,
          lastBlockStartedAt: null,
          failedAttemptsInWindow: 0,
          completedChangesAt: [],
        },
      });

      await expect(useCase.execute({ userId })).resolves.toEqual({ status: true });
      expect(stateLoader.load).toHaveBeenCalledWith(userId, now);
    });

    it('returns false and the longest retry when the policy finds a restriction', async () => {
      stateLoader.load.mockResolvedValue({
        state: {
          blockedUntil: new Date(now.getTime() + 3_600_000),
          lastBlockStartedAt: now,
          failedAttemptsInWindow: 5,
          completedChangesAt: [new Date(now.getTime() - 60_000)],
        },
      });

      await expect(useCase.execute({ userId: randomUUID() })).resolves.toEqual({
        status: false,
        retryAfterSeconds: 3_600,
      });
    });

    it('returns false with the pending TTL when another mutation is in progress', async () => {
      stateLoader.load.mockRejectedValue(new PasswordChangeOperationPendingError(17));

      await expect(useCase.execute({ userId: randomUUID() })).resolves.toEqual({
        status: false,
        retryAfterSeconds: 17,
      });
    });

    it('preserves state unavailability instead of reporting a permissive status', async () => {
      stateLoader.load.mockRejectedValue(new PasswordChangeStateUnavailableError());

      await expect(useCase.execute({ userId: randomUUID() })).rejects.toBeInstanceOf(
        PasswordChangeStateUnavailableError,
      );
    });
  });
});
