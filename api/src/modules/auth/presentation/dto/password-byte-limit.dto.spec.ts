import { ChangeUserPasswordDto } from '@/modules/auth/presentation/dto/change-user-password.dto';
import { LinkEmailProviderDto } from '@/modules/auth/presentation/dto/link-email-provider.dto';
import { LoginEmailDto } from '@/modules/auth/presentation/dto/login-email.dto';
import { RegisterDto } from '@/modules/auth/presentation/dto/register.dto';
import { validate } from 'class-validator';

describe('Authentication password DTO byte limit', () => {
  const passwordAtLimit = 'é'.repeat(36);
  const passwordAboveLimit = `${passwordAtLimit}a`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [
      'registration',
      () =>
        Object.assign(new RegisterDto(), {
          userName: 'user_name',
          email: 'user@example.com',
          password: passwordAtLimit,
        }),
    ],
    [
      'email provider linking',
      () =>
        Object.assign(new LinkEmailProviderDto(), {
          email: 'user@example.com',
          password: passwordAtLimit,
        }),
    ],
    [
      'password change',
      () =>
        Object.assign(new ChangeUserPasswordDto(), {
          currentPassword: passwordAtLimit,
          newPassword: passwordAtLimit,
        }),
    ],
    [
      'login contract',
      () =>
        Object.assign(new LoginEmailDto(), {
          email: 'user@example.com',
          password: passwordAtLimit,
        }),
    ],
  ])('accepts exactly 72 UTF-8 bytes for %s', async (_name, createDto) => {
    await expect(validate(createDto())).resolves.toHaveLength(0);
  });

  it.each([
    [
      'registration password',
      'password',
      () =>
        Object.assign(new RegisterDto(), {
          userName: 'user_name',
          email: 'user@example.com',
          password: passwordAboveLimit,
        }),
    ],
    [
      'email provider password',
      'password',
      () =>
        Object.assign(new LinkEmailProviderDto(), {
          email: 'user@example.com',
          password: passwordAboveLimit,
        }),
    ],
    [
      'current password',
      'currentPassword',
      () =>
        Object.assign(new ChangeUserPasswordDto(), {
          currentPassword: passwordAboveLimit,
          newPassword: passwordAtLimit,
        }),
    ],
    [
      'new password',
      'newPassword',
      () =>
        Object.assign(new ChangeUserPasswordDto(), {
          currentPassword: passwordAtLimit,
          newPassword: passwordAboveLimit,
        }),
    ],
    [
      'login password',
      'password',
      () =>
        Object.assign(new LoginEmailDto(), {
          email: 'user@example.com',
          password: passwordAboveLimit,
        }),
    ],
  ])('rejects 73 UTF-8 bytes for %s', async (_name, property, createDto) => {
    const errors = await validate(createDto());
    const fieldError = errors.find(error => error.property === property);

    expect(fieldError).toBeDefined();
    expect(fieldError?.constraints).toHaveProperty('isPasswordWithinUtf8ByteLimit');
    expect(typeof fieldError?.constraints?.isPasswordWithinUtf8ByteLimit).toBe('string');
  });
});
