import { formatAllowedTransactionAttachmentTypes } from '@/common/models/constants';
import { ApplicationError } from '@/shared/application';

export class UnsupportedAttachmentFileError extends ApplicationError {
  readonly code = 'UNSUPPORTED_ATTACHMENT_FILE';

  constructor(message = `Only ${formatAllowedTransactionAttachmentTypes()} images are supported as attachments.`) {
    super(message);
  }
}
