import { ApplicationError } from '@/shared/application';

export class AvatarUploadFailedError extends ApplicationError {
  readonly code = 'AVATAR_UPLOAD_FAILED';

  constructor() {
    super('Avatar image could not be stored.');
  }
}
