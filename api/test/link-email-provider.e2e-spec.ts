/* eslint-disable @typescript-eslint/unbound-method */
import { AppExceptionFilter } from '@/common/filters';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { createValidationException } from '@/common/validation';
import appConfig from '@/config/app.config';
import jwtConfig from '@/config/jwt.config';
import { AuthProviderAlreadyLinkedError } from '@/modules/auth/application/errors';
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
import { AuthController } from '@/modules/auth/presentation/http/auth.controller';
import { PasswordChangeCostGuard } from '@/modules/auth/presentation/guards/password-change-cost.guard';
import { User } from '@/modules/users/domain/entities/user.entity';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

describe('Link EMAIL provider HTTP contract (e2e)', () => {
  let app: INestApplication;
  let linkEmailProviderUseCase: jest.Mocked<LinkEmailProviderUseCase>;
  const userId = randomUUID();
  const user = User.reconstitute(
    {
      userName: null,
      firstName: null,
      lastName: null,
      email: Email.reconstitute('principal@example.com'),
      status: UserStatus.PENDING_PROFILE,
      avatarAssetId: null,
      authProviders: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    userId,
  );

  beforeEach(async () => {
    linkEmailProviderUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LinkEmailProviderUseCase>;
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: SignUpUseCase, useValue: {} },
        { provide: SignInUseCase, useValue: {} },
        { provide: LogoutUseCase, useValue: {} },
        { provide: ConfirmEmailVerificationUseCase, useValue: {} },
        { provide: ResendEmailVerificationUseCase, useValue: {} },
        { provide: RefreshTokensUseCase, useValue: {} },
        { provide: GetActiveSessionsUseCase, useValue: {} },
        { provide: RevokeSessionUseCase, useValue: {} },
        { provide: LinkEmailProviderUseCase, useValue: linkEmailProviderUseCase },
        { provide: RefreshTokenValidationService, useValue: {} },
        { provide: ChangeUserPasswordUseCase, useValue: {} },
        { provide: GetPasswordChangeStatusUseCase, useValue: {} },
        { provide: GetEmailVerificationResendStatusUseCase, useValue: {} },
        {
          provide: jwtConfig.KEY,
          useValue: { accessExpiresIn: '15m', refreshExpiresIn: '7d' },
        },
        {
          provide: appConfig.KEY,
          useValue: { frontendUrl: 'https://app.example.com' },
        },
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: createValidationException,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('accepts a password-only request and returns the identified response DTO', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/providers/link/email')
      .send({ password: 'password123' })
      .expect(200);

    expect(response.body).toEqual({
      object: 'auth_provider.email_link',
      message: 'Email provider linked successfully',
    });
    expect(linkEmailProviderUseCase.execute).toHaveBeenCalledWith({
      userId,
      password: 'password123',
    });
  });

  it('accepts and completely ignores the deprecated email field', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/providers/link/email')
      .send({
        email: 'different@example.com',
        password: 'password123',
      })
      .expect(200);

    expect(linkEmailProviderUseCase.execute).toHaveBeenCalledWith({
      userId,
      password: 'password123',
    });
    expect(linkEmailProviderUseCase.execute.mock.calls).toEqual([[{ userId, password: 'password123' }]]);
  });

  it('rejects unknown fields while continuing to whitelist only deprecated email', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/providers/link/email')
      .send({ password: 'password123', userId: randomUUID() })
      .expect(400);

    expect(linkEmailProviderUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects a password above 72 UTF-8 bytes before hashing', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/providers/link/email')
      .send({ password: `${'é'.repeat(36)}a` })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(linkEmailProviderUseCase.execute).not.toHaveBeenCalled();
  });

  it('uses the platform conflict contract when EMAIL is already linked', async () => {
    linkEmailProviderUseCase.execute.mockRejectedValue(new AuthProviderAlreadyLinkedError(AuthProviderType.EMAIL));

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/providers/link/email')
      .send({ password: 'password123' })
      .expect(409);

    expect(response.body).toMatchObject({ code: 'AUTH_PROVIDER_ALREADY_LINKED' });
  });
});
