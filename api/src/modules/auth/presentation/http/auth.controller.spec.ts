/* eslint-disable @typescript-eslint/unbound-method */
import { Email } from '@/common/domain/value-objects/email.value-object';
import { UserStatus } from '@/common/models/enums';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import appConfig from '@/config/app.config';
import jwtConfig from '@/config/jwt.config';
import { RefreshTokenValidationService } from '@/modules/auth/application/services/refresh-token-validation.service';
import { ChangeUserPasswordUseCase } from '@/modules/auth/application/use-cases/change-user-password/change-user-password.use-case';
import { ConfirmEmailVerificationUseCase } from '@/modules/auth/application/use-cases/confirm-email-verification/confirm-email-verification.use-case';
import { GetActiveSessionsUseCase } from '@/modules/auth/application/use-cases/get-active-sessions/get-active-sessions.use-case';
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
import { Test } from '@nestjs/testing';
import { Response } from 'express';
import { randomUUID } from 'node:crypto';

describe('AuthController', () => {
  let controller: AuthController;
  let changeUserPasswordUseCase: jest.Mocked<ChangeUserPasswordUseCase>;

  beforeEach(async () => {
    changeUserPasswordUseCase = {
      execute: jest.fn().mockResolvedValue({ status: 'CHANGED' }),
    } as unknown as jest.Mocked<ChangeUserPasswordUseCase>;
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

    controller = moduleRef.get(AuthController);
  });

  describe('changePassword', () => {
    it('uses only authenticated identity/context and clears both auth cookies after success', async () => {
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
      const request = {
        authToken: {
          jti: sessionId,
          sub: userId,
        },
        ip: '203.0.113.10',
        headers: {
          'user-agent': 'Test Browser',
        },
        socket: {
          remoteAddress: '203.0.113.10',
        },
      } as AuthRequest;
      const response = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      await expect(
        controller.changePassword(
          user,
          {
            currentPassword: 'current-password',
            newPassword: 'new-password',
          },
          {
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
            ip: '203.0.113.10',
            location: 'Fortaleza',
            loginAt: new Date().toISOString(),
          },
          request,
          response,
        ),
      ).resolves.toMatchObject({
        object: 'auth.password_change',
        status: 'CHANGED',
      });

      expect(changeUserPasswordUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId,
          ipAddress: '203.0.113.10',
          currentPassword: 'current-password',
          newPassword: 'new-password',
        }),
      );
      expect(response.clearCookie).toHaveBeenCalledTimes(2);
    });
  });
});
