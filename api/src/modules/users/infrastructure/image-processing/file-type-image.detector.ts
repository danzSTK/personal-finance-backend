import {
  DetectedImageFileType,
  IImageFileTypeDetector,
} from '@/modules/users/application/ports/image-file-type-detector.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FileTypeImageDetector implements IImageFileTypeDetector {
  async detect(input: Uint8Array): Promise<DetectedImageFileType | null> {
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(input);

    if (!detected) {
      return null;
    }

    return {
      mime: detected.mime,
      extension: detected.ext,
    };
  }
}
