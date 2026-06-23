import objectStorageConfig from '@/config/object-storage.config';
import { OBJECT_STORAGE_CLIENT } from '@/shared/object-storage/object-storage.tokens';
import { S3Client } from '@aws-sdk/client-s3';
import { Provider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

export const S3ClientProvider: Provider = {
  provide: OBJECT_STORAGE_CLIENT,
  inject: [objectStorageConfig.KEY],
  useFactory: (config: ConfigType<typeof objectStorageConfig>): S3Client =>
    new S3Client({
      endpoint: config.endpoint,
      region: 'auto',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
};
