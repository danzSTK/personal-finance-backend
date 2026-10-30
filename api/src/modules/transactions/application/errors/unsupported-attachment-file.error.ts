import { ApplicationError } from '@/shared/application';

export class UnsupportedAttachmentFileError extends ApplicationError {
  readonly code = 'UNSUPPORTED_ATTACHMENT_FILE';

  constructor(message = 'Only PNG, JPEG, and WebP images are supported as attachments.') {
    super(message);
  }
}
