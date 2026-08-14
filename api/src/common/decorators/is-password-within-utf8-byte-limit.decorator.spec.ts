import { IsPasswordWithinUtf8ByteLimit } from '@/common/decorators/is-password-within-utf8-byte-limit.decorator';
import { createValidationException } from '@/common/validation';
import { validate } from 'class-validator';

class PasswordInput {
  @IsPasswordWithinUtf8ByteLimit()
  password!: unknown;
}

describe('IsPasswordWithinUtf8ByteLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a password with exactly 72 UTF-8 bytes', async () => {
    const input = new PasswordInput();
    input.password = '😀'.repeat(18);

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects a password with 73 UTF-8 bytes without exposing its value', async () => {
    const password = `${'😀'.repeat(18)}a`;
    const input = new PasswordInput();
    input.password = password;

    const errors = await validate(input);
    const messages = Object.values(errors[0]?.constraints ?? {});
    const exception = createValidationException(errors);

    expect(messages).toContain('password must not exceed 72 bytes when encoded as UTF-8.');
    expect(JSON.stringify(exception.getResponse())).not.toContain(password);
  });

  it('rejects non-string values', async () => {
    const input = new PasswordInput();
    input.password = 123;

    await expect(validate(input)).resolves.toHaveLength(1);
  });
});
