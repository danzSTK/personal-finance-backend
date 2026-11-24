import { FileTypeSignatureDetector } from '@/shared/file-detection/adapters';
import { IFileSignatureDetector } from '@/shared/file-detection/contracts';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: IFileSignatureDetector,
      useClass: FileTypeSignatureDetector,
    },
  ],
  exports: [IFileSignatureDetector],
})
export class FileDetectionModule {}
