import { ApplicationError } from '@/shared/application';

export class AvatarFileTooLargeError extends ApplicationError {
  readonly code = 'AVATAR_FILE_TOO_LARGE';

  constructor() {
    super('Avatar image exceeds the maximum allowed size.');
  }
}
