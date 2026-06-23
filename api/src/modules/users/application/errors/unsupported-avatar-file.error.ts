import { ApplicationError } from '@/shared/application';

export class UnsupportedAvatarFileError extends ApplicationError {
  readonly code = 'UNSUPPORTED_AVATAR_FILE';

  constructor() {
    super('Avatar image format is not supported.');
  }
}
