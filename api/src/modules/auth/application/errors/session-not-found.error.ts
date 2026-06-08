import { ApplicationError } from '@/shared/application';

export class SessionNotFoundError extends ApplicationError {
  readonly code = 'SESSION_NOT_FOUND';

  constructor(message = 'Session not found.') {
    super(message);
  }
}
