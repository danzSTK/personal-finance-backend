import {
  TRANSACTION_ATTACHMENT_ALLOWED_MEDIA_TYPES,
  TRANSACTION_ATTACHMENT_MAX_INPUT_BYTES,
  TRANSACTION_ATTACHMENT_MAX_INPUT_PIXELS,
  TransactionAttachmentAllowedMediaType,
} from '@/common/models/constants';
import {
  AttachmentDimensionsExceededError,
  AttachmentFileTooLargeError,
  UnsupportedAttachmentFileError,
} from '@/modules/transactions/application/errors';
import { DetectedFileSignature, IFileSignatureDetector } from '@/shared/file-detection';
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface ValidatedAttachmentImage {
  contentType: TransactionAttachmentAllowedMediaType;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

function isAllowedAttachmentMediaType(mime: string): mime is TransactionAttachmentAllowedMediaType {
  return (TRANSACTION_ATTACHMENT_ALLOWED_MEDIA_TYPES as readonly string[]).includes(mime);
}

@Injectable()
export class TransactionAttachmentImageValidator {
  constructor(private readonly fileSignatureDetector: IFileSignatureDetector) {}

  async validate(buffer: Buffer): Promise<ValidatedAttachmentImage> {
    if (buffer.length > TRANSACTION_ATTACHMENT_MAX_INPUT_BYTES) {
      throw new AttachmentFileTooLargeError();
    }

    let detectedType: DetectedFileSignature | null;
    try {
      detectedType = await this.fileSignatureDetector.detect(buffer);
    } catch {
      throw new UnsupportedAttachmentFileError();
    }

    if (!detectedType || !isAllowedAttachmentMediaType(detectedType.mime)) {
      throw new UnsupportedAttachmentFileError();
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(buffer).metadata();
    } catch {
      throw new UnsupportedAttachmentFileError();
    }

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width * height > TRANSACTION_ATTACHMENT_MAX_INPUT_PIXELS) {
      throw new AttachmentDimensionsExceededError();
    }

    return {
      contentType: detectedType.mime,
      width,
      height,
      format: metadata.format ?? detectedType.extension,
      sizeBytes: buffer.length,
    };
  }
}
