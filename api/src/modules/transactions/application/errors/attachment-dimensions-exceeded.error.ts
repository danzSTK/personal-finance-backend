import { ApplicationError } from '@/shared/application';

export class AttachmentDimensionsExceededError extends ApplicationError {
  readonly code = 'ATTACHMENT_DIMENSIONS_EXCEEDED';

  constructor(message = 'Attachment image resolution must not exceed 60 Megapixels.') {
    super(message);
  }
}
