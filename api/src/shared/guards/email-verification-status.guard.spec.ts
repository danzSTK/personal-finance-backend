import { ALLOW_PENDING_EMAIL_VERIFICATION_KEY } from '@/common/decorators/allow-pending-email-verification.decorator';
import { IS_PUBLIC_KEY } from '@/common/decorators/is-public.decorator';
import { UserStatus } from '@/common/models/enums';
import { EmailVerificationRequiredError } from '@/modules/auth/application/errors';
import { User } from '@/modules/users/domain/entities/user.entity';
import { EmailVerificationStatusGuard } from '@/shared/guards/email-verification-status.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const makeContext = (user: Partial<User> | null): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('EmailVerificationStatusGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: EmailVerificationStatusGuard;

  beforeEach(() => {
    jest.clearAllMocks();

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new EmailVerificationStatusGuard(reflector);
  });

  it('allows public routes', () => {
    reflector.getAllAndOverride.mockImplementation(key => key === IS_PUBLIC_KEY);

    expect(guard.canActivate(makeContext({ status: UserStatus.PENDING_EMAIL_VERIFICATION }))).toBe(true);
  });

  it('allows pending users on explicitly allowed routes', () => {
    reflector.getAllAndOverride.mockImplementation(key => key === ALLOW_PENDING_EMAIL_VERIFICATION_KEY);

    expect(guard.canActivate(makeContext({ status: UserStatus.PENDING_EMAIL_VERIFICATION }))).toBe(true);
  });

  it('blocks pending users by default', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(() => guard.canActivate(makeContext({ status: UserStatus.PENDING_EMAIL_VERIFICATION }))).toThrow(
      EmailVerificationRequiredError,
    );
  });

  it('allows active users', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(guard.canActivate(makeContext({ status: UserStatus.ACTIVE }))).toBe(true);
  });
});
