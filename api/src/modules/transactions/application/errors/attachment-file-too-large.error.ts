import { ApplicationError } from '@/shared/application';

export class AttachmentFileTooLargeError extends ApplicationError {
  readonly code = 'ATTACHMENT_FILE_TOO_LARGE';

  constructor(message = 'Attachment file must not exceed 5 MB.') {
    super(message);
  }
}
