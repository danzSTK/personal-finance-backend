import { AuthProviderType } from '@/common/models/enums';
import { ApplicationError } from '@/shared/application';

export class AuthProviderAlreadyLinkedError extends ApplicationError {
  readonly code = 'AUTH_PROVIDER_ALREADY_LINKED';

  constructor(provider: AuthProviderType) {
    super(`User already has a ${provider} provider.`);
  }
}
