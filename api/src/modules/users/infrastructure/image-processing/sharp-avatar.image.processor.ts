import {
  USER_AVATAR_ALLOWED_MEDIA_TYPES,
  USER_AVATAR_HEIGHT,
  USER_AVATAR_MAX_INPUT_BYTES,
  USER_AVATAR_MAX_INPUT_PIXELS,
  USER_AVATAR_WEBP_QUALITY,
  USER_AVATAR_WIDTH,
} from '@/common/models/constants';
import {
  AvatarFileTooLargeError,
  InvalidAvatarImageError,
  UnsupportedAvatarFileError,
} from '@/modules/users/application/errors';
import {
  IAvatarImageProcessor,
  ProcessedAvatarImage,
} from '@/modules/users/application/ports/avatar-image-processor.interface';
import {
  DetectedImageFileType,
  IImageFileTypeDetector,
} from '@/modules/users/application/ports/image-file-type-detector.interface';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

@Injectable()
export class SharpAvatarImageProcessor implements IAvatarImageProcessor {
  constructor(private readonly fileTypeDetector: IImageFileTypeDetector) {}

  async process(input: Uint8Array): Promise<ProcessedAvatarImage> {
    if (input.byteLength > USER_AVATAR_MAX_INPUT_BYTES) {
      throw new AvatarFileTooLargeError();
    }

    let detectedType: DetectedImageFileType | null;

    try {
      detectedType = await this.fileTypeDetector.detect(input);
    } catch {
      throw new InvalidAvatarImageError();
    }

    if (
      !detectedType ||
      !USER_AVATAR_ALLOWED_MEDIA_TYPES.includes(detectedType.mime as (typeof USER_AVATAR_ALLOWED_MEDIA_TYPES)[number])
    ) {
      throw new UnsupportedAvatarFileError();
    }

    try {
      const { data, info } = await sharp(input, {
        animated: false,
        failOn: 'error',
        limitInputPixels: USER_AVATAR_MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize(USER_AVATAR_WIDTH, USER_AVATAR_HEIGHT, {
          fit: 'cover',
          position: 'attention',
        })
        .webp({
          quality: USER_AVATAR_WEBP_QUALITY,
        })
        .toBuffer({
          resolveWithObject: true,
        });

      return {
        bytes: data,
        contentType: 'image/webp',
        sizeBytes: data.byteLength,
        checksum: createHash('sha256').update(data).digest('hex'),
        metadata: {
          width: info.width,
          height: info.height,
          format: 'webp',
        },
      };
    } catch {
      throw new InvalidAvatarImageError();
    }
  }
}
