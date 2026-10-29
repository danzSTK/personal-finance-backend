import {
  AttachmentDimensionsExceededError,
  AttachmentFileTooLargeError,
  UnsupportedAttachmentFileError,
} from '@/modules/transactions/application/errors';
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface ValidatedAttachmentImage {
  contentType: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

const MAX_ATTACHMENT_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ATTACHMENT_PIXELS = 60_000_000; // 60 MP

function detectAllowedImageMime(buffer: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buffer.length < 12) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

@Injectable()
export class TransactionAttachmentImageValidator {
  async validate(buffer: Buffer): Promise<ValidatedAttachmentImage> {
    if (buffer.length > MAX_ATTACHMENT_FILE_SIZE) {
      throw new AttachmentFileTooLargeError();
    }

    const mime = detectAllowedImageMime(buffer);
    if (!mime) {
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

    if (width * height > MAX_ATTACHMENT_PIXELS) {
      throw new AttachmentDimensionsExceededError();
    }

    return {
      contentType: mime,
      width,
      height,
      format: metadata.format ?? (mime === 'image/jpeg' ? 'jpeg' : mime === 'image/png' ? 'png' : 'webp'),
      sizeBytes: buffer.length,
    };
  }
}
