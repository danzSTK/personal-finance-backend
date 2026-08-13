/* eslint-disable @typescript-eslint/unbound-method */
import { AppExceptionFilter } from '@/common/filters';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { UserStatus } from '@/common/models/enums';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { createValidationException } from '@/common/validation';
import appConfig from '@/config/app.config';
import jwtConfig from '@/config/jwt.config';
import { PasswordChangeBlockedError } from '@/modules/auth/application/errors';
import { RefreshTokenValidationService } from '@/modules/auth/application/services/refresh-token-validation.service';
import { ChangeUserPasswordUseCase } from '@/modules/auth/application/use-cases/change-user-password/change-user-password.use-case';
import { GetPasswordChangeStatusUseCase } from '@/modules/auth/application/use-cases/get-password-change-status/get-password-change-status.use-case';
import { ConfirmEmailVerificationUseCase } from '@/modules/auth/application/use-cases/confirm-email-verification/confirm-email-verification.use-case';
import { GetActiveSessionsUseCase } from '@/modules/auth/application/use-cases/get-active-sessions/get-active-sessions.use-case';
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
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

describe('Change password HTTP contract (e2e)', () => {
  let app: INestApplication;
  let changeUserPasswordUseCase: jest.Mocked<ChangeUserPasswordUseCase>;
  let getPasswordChangeStatusUseCase: jest.Mocked<GetPasswordChangeStatusUseCase>;
  const userId = randomUUID();
  const sessionId = randomUUID();
  const user = User.reconstitute(
    {
      userName: null,
      firstName: null,
      lastName: null,
      email: Email.reconstitute('user@example.com'),
      status: UserStatus.ACTIVE,
      avatarAssetId: null,
      authProviders: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    userId,
  );

  beforeEach(async () => {
    changeUserPasswordUseCase = {
      execute: jest.fn().mockResolvedValue({ status: 'CHANGED' }),
    } as unknown as jest.Mocked<ChangeUserPasswordUseCase>;
    getPasswordChangeStatusUseCase = {
      execute: jest.fn().mockResolvedValue({ status: true }),
    } as unknown as jest.Mocked<GetPasswordChangeStatusUseCase>;
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
        { provide: LinkEmailProviderUseCase, useValue: {} },
        { provide: RefreshTokenValidationService, useValue: {} },
        { provide: ChangeUserPasswordUseCase, useValue: changeUserPasswordUseCase },
        { provide: GetPasswordChangeStatusUseCase, useValue: getPasswordChangeStatusUseCase },
        {
          provide: jwtConfig.KEY,
          useValue: {
            accessExpiresIn: '15m',
            refreshExpiresIn: '7d',
          },
        },
        {
          provide: appConfig.KEY,
          useValue: {
            frontendUrl: 'https://app.example.com',
          },
        },
      ],
    })
      .overrideGuard(PasswordChangeCostGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const authRequest = req as AuthRequest;
      authRequest.user = user;
      authRequest.authToken = {
        sub: userId,
        jti: sessionId,
        credentialVersion: 1,
      };
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
    await app.close();
  });

  it('returns the response DTO and expires both authentication cookies', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/password/change')
      .set('User-Agent', 'Test Browser')
      .send({
        currentPassword: 'current-password',
        newPassword: 'new-password',
      })
      .expect(200);

    expect(response.body).toEqual({
      object: 'auth.password_change',
      status: 'CHANGED',
    });
    expect(response.headers['set-cookie']).toHaveLength(2);
    expect(changeUserPasswordUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        sessionId,
      }),
    );
  });

  it('returns platform retry details and the Retry-After header', async () => {
    changeUserPasswordUseCase.execute.mockRejectedValue(new PasswordChangeBlockedError(61));

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/password/change')
      .send({
        currentPassword: 'current-password',
        newPassword: 'new-password',
      })
      .expect(429);

    expect(response.headers['retry-after']).toBe('61');
    expect(response.body).toMatchObject({
      code: 'PASSWORD_CHANGE_BLOCKED',
      details: {
        retryAfterSeconds: 61,
      },
    });
  });

  it('rejects invalid or unknown body fields before the use case', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/password/change')
      .send({
        currentPassword: 'short',
        newPassword: 'new-password',
        userId: randomUUID(),
      })
      .expect(400);

    expect(changeUserPasswordUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns true without Retry-After when password change is available', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/auth/password/change/status')
      .expect(200);

    expect(response.body).toEqual({
      object: 'auth.password_change_status',
      status: true,
    });
    expect(response.headers['retry-after']).toBeUndefined();
    expect(getPasswordChangeStatusUseCase.execute).toHaveBeenCalledWith({ userId });
  });

  it('returns false and Retry-After without revealing the restriction reason', async () => {
    getPasswordChangeStatusUseCase.execute.mockResolvedValue({
      status: false,
      retryAfterSeconds: 527,
    });

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/auth/password/change/status')
      .expect(200);

    expect(response.body).toEqual({
      object: 'auth.password_change_status',
      status: false,
    });
    expect(response.headers['retry-after']).toBe('527');
    expect(JSON.stringify(response.body)).not.toContain('reason');
  });
});
