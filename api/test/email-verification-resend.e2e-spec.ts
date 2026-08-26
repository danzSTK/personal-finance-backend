/* eslint-disable @typescript-eslint/unbound-method */
import { Email } from '@/common/domain/value-objects/email.value-object';
import { AppExceptionFilter } from '@/common/filters';
import { UserStatus } from '@/common/models/enums';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import appConfig from '@/config/app.config';
import jwtConfig from '@/config/jwt.config';
import {
  EmailVerificationCooldownActiveError,
  EmailVerificationStateUnavailableError,
} from '@/modules/auth/application/errors';
import {
  EmailVerificationResendRestriction,
  EmailVerificationResendStatus,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { RefreshTokenValidationService } from '@/modules/auth/application/services/refresh-token-validation.service';
import { ChangeUserPasswordUseCase } from '@/modules/auth/application/use-cases/change-user-password/change-user-password.use-case';
import { ConfirmEmailVerificationUseCase } from '@/modules/auth/application/use-cases/confirm-email-verification/confirm-email-verification.use-case';
import { GetActiveSessionsUseCase } from '@/modules/auth/application/use-cases/get-active-sessions/get-active-sessions.use-case';
import { GetEmailVerificationResendStatusUseCase } from '@/modules/auth/application/use-cases/get-email-verification-resend-status/get-email-verification-resend-status.use-case';
import { GetPasswordChangeStatusUseCase } from '@/modules/auth/application/use-cases/get-password-change-status/get-password-change-status.use-case';
import { LinkEmailProviderUseCase } from '@/modules/auth/application/use-cases/link-email-provider/link-email-provider.use-case';
import { LogoutUseCase } from '@/modules/auth/application/use-cases/logout/logout.use-case';
import { RefreshTokensUseCase } from '@/modules/auth/application/use-cases/refresh-tokens/refresh-tokens.use-case';
import { ResendEmailVerificationUseCase } from '@/modules/auth/application/use-cases/resend-email-verification/resend-email-verification.use-case';
import { RevokeSessionUseCase } from '@/modules/auth/application/use-cases/revoke-session/revoke-session.use-case';
import { SignInUseCase } from '@/modules/auth/application/use-cases/sign-in/sign-in.use-case';
import { SignUpUseCase } from '@/modules/auth/application/use-cases/sign-up/sign-up.use-case';
import { PasswordChangeCostGuard } from '@/modules/auth/presentation/guards/password-change-cost.guard';
import { AuthController } from '@/modules/auth/presentation/http/auth.controller';
import { User } from '@/modules/users/domain/entities/user.entity';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

describe('Email verification resend HTTP contract (e2e)', () => {
  let app: INestApplication;
  let resendUseCase: jest.Mocked<ResendEmailVerificationUseCase>;
  let statusUseCase: jest.Mocked<GetEmailVerificationResendStatusUseCase>;
  const userId = randomUUID();
  const user = User.reconstitute(
    {
      userName: null,
      firstName: 'Daniel',
      lastName: null,
      email: Email.reconstitute('pending@example.com'),
      status: UserStatus.PENDING_EMAIL_VERIFICATION,
      avatarAssetId: null,
      authProviders: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    userId,
  );

  beforeEach(async () => {
    resendUseCase = {
      execute: jest.fn().mockResolvedValue({ status: EmailVerificationResendStatus.QUEUED }),
    } as unknown as jest.Mocked<ResendEmailVerificationUseCase>;
    statusUseCase = {
      execute: jest.fn().mockResolvedValue({
        status: EmailVerificationResendStatus.AVAILABLE,
        available: true,
        manualResendsUsed: 0,
        manualResendsRemaining: 5,
        lastLogicalSendAt: null,
      }),
    } as unknown as jest.Mocked<GetEmailVerificationResendStatusUseCase>;
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: SignUpUseCase, useValue: {} },
        { provide: SignInUseCase, useValue: {} },
        { provide: LogoutUseCase, useValue: {} },
        { provide: ConfirmEmailVerificationUseCase, useValue: {} },
        { provide: ResendEmailVerificationUseCase, useValue: resendUseCase },
        { provide: GetEmailVerificationResendStatusUseCase, useValue: statusUseCase },
        { provide: RefreshTokensUseCase, useValue: {} },
        { provide: GetActiveSessionsUseCase, useValue: {} },
        { provide: RevokeSessionUseCase, useValue: {} },
        { provide: LinkEmailProviderUseCase, useValue: {} },
        { provide: RefreshTokenValidationService, useValue: {} },
        { provide: ChangeUserPasswordUseCase, useValue: {} },
        { provide: GetPasswordChangeStatusUseCase, useValue: {} },
        { provide: jwtConfig.KEY, useValue: { accessExpiresIn: '15m', refreshExpiresIn: '7d' } },
        { provide: appConfig.KEY, useValue: { frontendUrl: 'https://app.example.com' } },
      ],
    })
      .overrideGuard(PasswordChangeCostGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as AuthRequest).user = user;
      next();
    });
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the available status without Retry-After and disables caching', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/auth/email-verification/resend/status')
      .expect(200);

    expect(response.body).toEqual({
      object: 'email_verification.resend_status.available',
      status: EmailVerificationResendStatus.AVAILABLE,
      available: true,
      retryAfterSeconds: null,
      manualResendsUsed: 0,
      manualResendsRemaining: 5,
      manualResendLimit: 5,
      windowSeconds: 86400,
      lastLogicalSendAt: null,
    });
    expect(response.headers['retry-after']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(statusUseCase.execute).toHaveBeenCalledWith({ userId });
  });

  it('returns the blocked status with matching body and Retry-After', async () => {
    statusUseCase.execute.mockResolvedValue({
      status: EmailVerificationResendStatus.BLOCKED,
      available: false,
      blockedBy: EmailVerificationResendRestriction.DAILY_LIMIT,
      retryAfterSeconds: 527,
      manualResendsUsed: 5,
      manualResendsRemaining: 0,
      lastLogicalSendAt: new Date('2026-08-26T00:00:00.000Z'),
    });

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/auth/email-verification/resend/status')
      .expect(200);

    expect(response.body).toMatchObject({
      object: 'email_verification.resend_status.blocked',
      blockedBy: EmailVerificationResendRestriction.DAILY_LIMIT,
      retryAfterSeconds: 527,
    });
    expect(response.headers['retry-after']).toBe('527');
  });

  it('returns the already-verified shape without Retry-After', async () => {
    statusUseCase.execute.mockResolvedValue({
      status: EmailVerificationResendStatus.ALREADY_VERIFIED,
      available: false,
    });

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/auth/email-verification/resend/status')
      .expect(200);

    expect(response.body).toEqual({
      object: 'email_verification.resend_status.already_verified',
      status: EmailVerificationResendStatus.ALREADY_VERIFIED,
      available: false,
      retryAfterSeconds: null,
    });
    expect(response.headers['retry-after']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('fails closed with the stable 503 code when status state is unavailable', async () => {
    statusUseCase.execute.mockRejectedValue(new EmailVerificationStateUnavailableError());

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/auth/email-verification/resend/status')
      .expect(503);

    expect(response.body).toMatchObject({
      statusCode: 503,
      code: 'EMAIL_VERIFICATION_STATE_UNAVAILABLE',
      details: null,
    });
    expect(response.headers['retry-after']).toBeUndefined();
  });

  it('queues a resend with 202 and maps policy blocks to the platform retry contract', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/email-verification/resend')
      .expect(202)
      .expect({ object: 'email_verification.resend', status: EmailVerificationResendStatus.QUEUED });

    resendUseCase.execute.mockRejectedValue(new EmailVerificationCooldownActiveError(61));
    const blocked = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/email-verification/resend')
      .expect(429);

    expect(blocked.headers['retry-after']).toBe('61');
    expect(blocked.body).toMatchObject({
      code: 'EMAIL_VERIFICATION_COOLDOWN_ACTIVE',
      details: { retryAfterSeconds: 61 },
    });
  });
});
