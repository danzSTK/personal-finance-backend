import { USER_PASSWORD_MAX_UTF8_BYTES } from '@/common/models/constants';
import { DomainError } from '@/shared/domain';

export class PasswordByteLimitExceededError extends DomainError {
  readonly code = 'PASSWORD_BYTE_LIMIT_EXCEEDED';

  constructor() {
    super(`Password must not exceed ${USER_PASSWORD_MAX_UTF8_BYTES} bytes when encoded as UTF-8.`);
  }
}
