import { USER_PASSWORD_MAX_UTF8_BYTES } from '@/common/models/constants';
import { isPasswordWithinUtf8ByteLimit } from '@/common/utils/password-byte-length.util';

describe('isPasswordWithinUtf8ByteLimit', () => {
  it.each([
    ['', true],
    ['a'.repeat(USER_PASSWORD_MAX_UTF8_BYTES), true],
    ['a'.repeat(USER_PASSWORD_MAX_UTF8_BYTES + 1), false],
    ['é'.repeat(36), true],
    [`${'é'.repeat(36)}a`, false],
    ['😀'.repeat(18), true],
    [`${'😀'.repeat(18)}a`, false],
  ])('returns the expected result for %p', (password, expected) => {
    expect(isPasswordWithinUtf8ByteLimit(password)).toBe(expected);
  });
});
