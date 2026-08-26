/* eslint-disable @typescript-eslint/unbound-method */
import { UserStatus } from '@/common/models/enums';
import { EmailVerificationStateUnavailableError } from '@/modules/auth/application/errors';
import { IEmailVerificationResendStateStore } from '@/modules/auth/application/ports/email-verification-resend-state-store.interface';
import { GetEmailVerificationResendStatusUseCase } from '@/modules/auth/application/use-cases/get-email-verification-resend-status/get-email-verification-resend-status.use-case';
import {
  EmailVerificationResendRestriction,
  EmailVerificationResendStatus,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';

describe('GetEmailVerificationResendStatusUseCase', () => {
  let userRepository: jest.Mocked<IUserRepository>;
  let stateStore: jest.Mocked<IEmailVerificationResendStateStore>;
  let useCase: GetEmailVerificationResendStatusUseCase;

  beforeEach(() => {
    userRepository = { findById: jest.fn() } as unknown as jest.Mocked<IUserRepository>;
    stateStore = { load: jest.fn() } as unknown as jest.Mocked<IEmailVerificationResendStateStore>;
    useCase = new GetEmailVerificationResendStatusUseCase(userRepository, stateStore);
    jest.clearAllMocks();
  });

  it('returns already verified without touching Redis', async () => {
    userRepository.findById.mockResolvedValue({ id: 'user-1', status: UserStatus.ACTIVE } as User);

    await expect(useCase.execute({ userId: 'user-1' })).resolves.toEqual({
      status: EmailVerificationResendStatus.ALREADY_VERIFIED,
      available: false,
    });
    expect(stateStore.load).not.toHaveBeenCalled();
  });

  it('returns an available state with the current manual counters', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.PENDING_EMAIL_VERIFICATION,
    } as User);
    stateStore.load.mockResolvedValue({
      kind: EmailVerificationResendStatus.AVAILABLE,
      manualResendsUsed: 1,
      manualResendsRemaining: 4,
      lastLogicalSendAt: null,
    });

    await expect(useCase.execute({ userId: 'user-1' })).resolves.toEqual({
      status: EmailVerificationResendStatus.AVAILABLE,
      available: true,
      manualResendsUsed: 1,
      manualResendsRemaining: 4,
      lastLogicalSendAt: null,
    });
  });

  it('returns the blocked state with the effective retry', async () => {
    const lastLogicalSendAt = new Date('2026-08-26T00:00:00.000Z');
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.PENDING_EMAIL_VERIFICATION,
    } as User);
    stateStore.load.mockResolvedValue({
      kind: EmailVerificationResendStatus.BLOCKED,
      blockedBy: EmailVerificationResendRestriction.COOLDOWN,
      retryAfterSeconds: 91,
      manualResendsUsed: 2,
      manualResendsRemaining: 3,
      lastLogicalSendAt,
    });

    await expect(useCase.execute({ userId: 'user-1' })).resolves.toMatchObject({
      status: EmailVerificationResendStatus.BLOCKED,
      blockedBy: EmailVerificationResendRestriction.COOLDOWN,
      retryAfterSeconds: 91,
      lastLogicalSendAt,
    });
  });

  it('fails closed when Redis is unavailable', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.PENDING_EMAIL_VERIFICATION,
    } as User);
    stateStore.load.mockRejectedValue(new Error('redis unavailable'));

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toBeInstanceOf(EmailVerificationStateUnavailableError);
  });
});
