import { DomainError } from '@/shared/domain';

export class InvalidAssetError extends DomainError {
  readonly code = 'INVALID_ASSET';

  constructor(message = 'Invalid asset.') {
    super(message);
  }
}
