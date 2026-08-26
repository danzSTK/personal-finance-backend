/* eslint-disable @typescript-eslint/unbound-method */
import notificationsConfig from '@/config/notifications.config';
import { CreateEmailVerificationChallengeUseCase } from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import {
  EmailVerificationChallengeOrigin,
  EmailVerificationPurpose,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import { IEmailVerificationChallengeRepository } from '@/modules/auth/domain/repositories/email-verification-challenge.repository.interface';
import { ConfigType } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

describe('CreateEmailVerificationChallengeUseCase', () => {
  let repository: jest.Mocked<IEmailVerificationChallengeRepository>;
  let useCase: CreateEmailVerificationChallengeUseCase;
  const manager = {} as EntityManager;

  beforeEach(() => {
    repository = {
      findByTokenHash: jest.fn(),
      findByTokenHashForUpdate: jest.fn(),
      findByUserIdPurposeAndOrigin: jest.fn(),
      saveAutomaticIfAbsent: jest.fn(),
      save: jest.fn(),
    };
    useCase = new CreateEmailVerificationChallengeUseCase(
      repository,
      { emailVerificationTokenTtlMinutes: 15 } as ConfigType<typeof notificationsConfig>,
      { transaction: jest.fn() } as unknown as DataSource,
    );
    jest.clearAllMocks();
  });

  it('creates a manual challenge without querying temporal SQL policy', async () => {
    const now = new Date('2026-08-26T00:00:00.000Z');
    repository.save.mockImplementation(challenge => Promise.resolve(challenge));

    const result = await useCase.execute({
      userId: 'user-1',
      email: 'Daniel@Example.com',
      origin: EmailVerificationChallengeOrigin.MANUAL_RESEND,
      now,
      options: { manager },
    });

    expect(result.created).toBe(true);
    expect(result.token).toEqual(expect.any(String));
    expect(result.challenge.origin).toBe(EmailVerificationChallengeOrigin.MANUAL_RESEND);
    expect(result.challenge.createdAt).toEqual(now);
    expect(result.challenge.expiresAt).toEqual(new Date('2026-08-26T00:15:00.000Z'));
    expect(repository.save).toHaveBeenCalledWith(expect.any(EmailVerificationChallenge), { manager });
    expect(repository.saveAutomaticIfAbsent).not.toHaveBeenCalled();
  });

  it('returns the existing automatic challenge without exposing an unavailable token', async () => {
    const existing = EmailVerificationChallenge.reconstitute(
      {
        userId: 'user-1',
        email: 'daniel@example.com',
        purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
        origin: EmailVerificationChallengeOrigin.AUTOMATIC,
        tokenHash: 'a'.repeat(64),
        expiresAt: new Date('2026-08-26T00:15:00.000Z'),
        consumedAt: null,
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
      },
      'challenge-existing',
    );
    repository.saveAutomaticIfAbsent.mockResolvedValue({ challenge: existing, created: false });

    await expect(
      useCase.execute({
        userId: 'user-1',
        email: 'daniel@example.com',
        origin: EmailVerificationChallengeOrigin.AUTOMATIC,
        options: { manager },
      }),
    ).resolves.toEqual({ challenge: existing, token: null, created: false });
  });
});
