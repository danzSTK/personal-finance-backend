import { ApplicationError } from '@/shared/application';

export class InvalidAccessTokenError extends ApplicationError {
  readonly code = 'INVALID_ACCESS_TOKEN';

  constructor(message = 'Invalid access token.') {
    super(message);
  }
}
