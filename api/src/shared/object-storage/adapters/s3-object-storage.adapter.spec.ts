import objectStorageConfig from '@/config/object-storage.config';
import { S3ObjectStorageAdapter } from '@/shared/object-storage/adapters/s3-object-storage.adapter';
import { ObjectStorageError, ObjectStorageErrorCode } from '@/shared/object-storage/errors';
import { PutObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

describe('S3ObjectStorageAdapter', () => {
  const publicBucket = 'public-assets';
  const privateBucket = 'private-assets';
  const key = 'users/user-id/avatars/avatar id.webp';
  const config = {
    accountId: 'account-id',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    publicBucketName: publicBucket,
    privateBucketName: privateBucket,
    endpoint: 'https://account-id.r2.cloudflarestorage.com',
    publicBaseUrl: 'https://assets.example.com/',
  } as ConfigType<typeof objectStorageConfig>;

  let send: jest.MockedFunction<(command: unknown) => Promise<unknown>>;
  let adapter: S3ObjectStorageAdapter;

  beforeEach(() => {
    send = jest.fn<Promise<unknown>, [command: unknown]>();
    adapter = new S3ObjectStorageAdapter({ send } as unknown as S3Client, config);
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.clearAllMocks();
  });

  describe('putObject', () => {
    it('converts a hexadecimal SHA-256 checksum to Base64', async () => {
      const checksumHex = 'a'.repeat(64);
      send.mockResolvedValue({ ETag: 'etag' });

      await adapter.putObject({
        bucket: publicBucket,
        key,
        body: Buffer.from('image'),
        contentType: 'image/webp',
        checksumSha256Hex: checksumHex,
      });

      const command = send.mock.calls[0]?.[0] as PutObjectCommand;

      expect(command.input.ChecksumSHA256).toBe(Buffer.from(checksumHex, 'hex').toString('base64'));
    });

    it('rejects an invalid hexadecimal checksum before sending', async () => {
      const promise = adapter.putObject({
        bucket: publicBucket,
        key,
        body: Buffer.from('image'),
        contentType: 'image/webp',
        checksumSha256Hex: 'invalid',
      });

      await expect(promise).rejects.toMatchObject({ code: ObjectStorageErrorCode.INVALID_REQUEST });
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('headObject', () => {
    it('returns null when the object does not exist', async () => {
      send.mockRejectedValue(createS3Error('NotFound', 404));

      await expect(adapter.headObject({ bucket: publicBucket, key })).resolves.toBeNull();
    });

    it('maps a service outage to a retryable technical error', async () => {
      send.mockRejectedValue(createS3Error('ServiceUnavailable', 503));

      await expect(adapter.headObject({ bucket: publicBucket, key })).rejects.toMatchObject({
        code: ObjectStorageErrorCode.UNAVAILABLE,
        retryable: true,
        statusCode: 503,
      });
    });
  });

  describe('deleteObject', () => {
    it('treats an absent object as an idempotent success', async () => {
      send.mockRejectedValue(createS3Error('NoSuchKey', 404));

      await expect(adapter.deleteObject({ bucket: publicBucket, key })).resolves.toBeUndefined();
    });
  });

  describe('buildPublicUrl', () => {
    it('builds an encoded URL for the configured public bucket', () => {
      expect(adapter.buildPublicUrl({ bucket: publicBucket, key })).toBe(
        'https://assets.example.com/users/user-id/avatars/avatar%20id.webp',
      );
    });

    it('rejects building a public URL for a private bucket', () => {
      expect(() => adapter.buildPublicUrl({ bucket: privateBucket, key })).toThrow(ObjectStorageError);
    });
  });

  function createS3Error(name: string, statusCode: number): S3ServiceException {
    return new S3ServiceException({
      name,
      $fault: statusCode >= 500 ? 'server' : 'client',
      $metadata: { httpStatusCode: statusCode, requestId: 'request-id', attempts: 3 },
      message: name,
    });
  }
});
