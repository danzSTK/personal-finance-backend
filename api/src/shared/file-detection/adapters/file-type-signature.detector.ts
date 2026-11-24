import {
  DetectedFileSignature,
  IFileSignatureDetector,
} from '@/shared/file-detection/contracts/file-signature-detector.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FileTypeSignatureDetector implements IFileSignatureDetector {
  async detect(input: Uint8Array): Promise<DetectedFileSignature | null> {
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
