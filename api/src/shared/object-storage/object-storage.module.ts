import { S3ObjectStorageAdapter } from '@/shared/object-storage/adapters/s3-object-storage.adapter';
import { IObjectStorage } from '@/shared/object-storage/contracts/object-storage.interface';
import { S3ClientProvider } from '@/shared/object-storage/providers/s3-client.provider';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    S3ClientProvider,
    {
      provide: IObjectStorage,
      useClass: S3ObjectStorageAdapter,
    },
  ],
  exports: [IObjectStorage],
})
export class ObjectStorageModule {}
