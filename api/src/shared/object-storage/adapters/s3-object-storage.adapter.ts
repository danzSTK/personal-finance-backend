import objectStorageConfig from '@/config/object-storage.config';
import { IObjectStorage } from '@/shared/object-storage/contracts/object-storage.interface';
import {
  ObjectLocation,
  PutObjectInput,
  PutObjectOutput,
  StoredObjectMetadata,
} from '@/shared/object-storage/contracts/object-storage.types';
import {
  isObjectNotFoundError,
  mapObjectStorageError,
  ObjectStorageError,
  ObjectStorageErrorCode,
  ObjectStorageOperation,
} from '@/shared/object-storage/errors';
import { OBJECT_STORAGE_CLIENT } from '@/shared/object-storage/object-storage.tokens';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

@Injectable()
export class S3ObjectStorageAdapter extends IObjectStorage {
  private readonly logger = new Logger(S3ObjectStorageAdapter.name);

  constructor(
    @Inject(OBJECT_STORAGE_CLIENT)
    private readonly client: S3Client,
    @Inject(objectStorageConfig.KEY)
    private readonly config: ConfigType<typeof objectStorageConfig>,
  ) {
    super();
  }
  async putObject(input: PutObjectInput): Promise<PutObjectOutput> {
    try {
      const command = new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
        ChecksumSHA256: this.toBase64Checksum(input.checksumSha256Hex),
        CacheControl: 'public, max-age=31536000, immutable',
      });

      const response = await this.client.send(command);

      return {
        etag: response.ETag ?? null,
        versionId: response.VersionId ?? null,
      };
    } catch (error) {
      throw this.handleError(error, 'PUT', input);
    }
  }
  async deleteObject(location: ObjectLocation): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: location.bucket,
        Key: location.key,
      });

      await this.client.send(command);

      return;
    } catch (error) {
      if (isObjectNotFoundError(error)) {
        return;
      }

      throw this.handleError(error, 'DELETE', location);
    }
  }
  async headObject(location: ObjectLocation): Promise<StoredObjectMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: location.bucket,
        Key: location.key,
      });

      const response = await this.client.send(command);

      return {
        contentType: response.ContentType ?? null,
        contentLength: response.ContentLength ?? null,
        etag: response.ETag ?? null,
        metadata: response.Metadata ?? {},
      };
    } catch (error) {
      if (isObjectNotFoundError(error)) {
        return null;
      }

      throw this.handleError(error, 'HEAD', location);
    }
  }

  buildPublicUrl(location: ObjectLocation): string {
    if (location.bucket !== this.config.publicBucketName) {
      throw new ObjectStorageError({
        code: ObjectStorageErrorCode.PUBLIC_URL_UNAVAILABLE,
        operation: 'BUILD_PUBLIC_URL',
        retryable: false,
      });
    }

    const baseUrl = this.config.publicBaseUrl?.replace(/\/+$/, '');
    const encodedKey = location.key
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');

    return `${baseUrl}/${encodedKey}`;
  }

  private toBase64Checksum(checksumHex?: string): string | undefined {
    if (checksumHex === undefined) {
      return undefined;
    }

    if (!/^[0-9a-f]{64}$/.test(checksumHex)) {
      throw new ObjectStorageError({
        code: ObjectStorageErrorCode.INVALID_REQUEST,
        operation: 'PUT',
        retryable: false,
      });
    }

    return Buffer.from(checksumHex, 'hex').toString('base64');
  }

  private handleError(error: unknown, operation: ObjectStorageOperation, location: ObjectLocation): ObjectStorageError {
    const mappedError = mapObjectStorageError(error, operation);

    this.logger.error(
      [
        `Object Storage ${operation} failed`,
        `code=${mappedError.code}`,
        `retryable=${mappedError.retryable}`,
        `bucket=${location.bucket}`,
        `key=${location.key}`,
        `statusCode=${mappedError.statusCode ?? 'unknown'}`,
        `requestId=${mappedError.requestId ?? 'unknown'}`,
        `attempts=${mappedError.attempts ?? 'unknown'}`,
      ].join(' '),
    );

    return mappedError;
  }
}
