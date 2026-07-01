import { DomainError } from '@/shared/domain';

export class InvalidEmailVerificationChallengeError extends DomainError {
  readonly code = 'INVALID_EMAIL_VERIFICATION_CHALLENGE';

  constructor(message = 'Invalid email verification challenge.') {
    super(message);
  }
}
