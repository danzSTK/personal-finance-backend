import { DomainError } from '@/shared/domain';

export class InvalidAssetStateTransitionError extends DomainError {
  readonly code = 'INVALID_ASSET_STATE_TRANSITION';

  constructor(message = 'Invalid asset state transition.') {
    super(message);
  }
}
