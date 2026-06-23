import { ApplicationError } from '@/shared/application';

export class InvalidAvatarImageError extends ApplicationError {
  readonly code = 'INVALID_AVATAR_IMAGE';

  constructor() {
    super('Avatar image could not be decoded.');
  }
}
