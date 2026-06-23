import { AuthProviderType } from '@/common/models/enums';
import { ApplicationError } from '@/shared/application';

export class AuthProviderLinkedToAnotherUserError extends ApplicationError {
  readonly code = 'AUTH_PROVIDER_LINKED_TO_ANOTHER_USER';

  constructor(provider: AuthProviderType) {
    super(`${provider} account already linked to another user.`);
  }
}
