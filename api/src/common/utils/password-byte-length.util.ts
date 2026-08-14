import { USER_PASSWORD_MAX_UTF8_BYTES } from '@/common/models/constants';

export function isPasswordWithinUtf8ByteLimit(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') <= USER_PASSWORD_MAX_UTF8_BYTES;
}
