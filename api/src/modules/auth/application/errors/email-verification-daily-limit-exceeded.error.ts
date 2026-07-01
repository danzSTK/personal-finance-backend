import { ApplicationError } from '@/shared/application';

export class EmailVerificationDailyLimitExceededError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_DAILY_LIMIT_EXCEEDED';

  constructor() {
    super('Email verification daily limit exceeded.');
  }
}
