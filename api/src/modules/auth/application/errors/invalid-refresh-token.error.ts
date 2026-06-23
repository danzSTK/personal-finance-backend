import { ApplicationError } from '@/shared/application';

export class InvalidRefreshTokenError extends ApplicationError {
  readonly code = 'INVALID_REFRESH_TOKEN';

  constructor(message = 'Invalid refresh token.') {
    super(message);
  }
}
