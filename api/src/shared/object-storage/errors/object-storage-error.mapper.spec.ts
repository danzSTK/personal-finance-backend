import { mapObjectStorageError, ObjectStorageErrorCode } from '@/shared/object-storage/errors';
import { S3ServiceException } from '@aws-sdk/client-s3';

describe('mapObjectStorageError', () => {
  it('maps access denied service errors', () => {
    const error = new S3ServiceException({
      name: 'AccessDenied',
      $fault: 'client',
      $metadata: { httpStatusCode: 403 },
      message: 'Access denied',
    });

    expect(mapObjectStorageError(error, 'PUT')).toMatchObject({
      code: ObjectStorageErrorCode.ACCESS_DENIED,
      retryable: false,
      statusCode: 403,
    });
  });

  it('maps connection resets as retryable unavailability', () => {
    const error = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });

    expect(mapObjectStorageError(error, 'PUT')).toMatchObject({
      code: ObjectStorageErrorCode.UNAVAILABLE,
      retryable: true,
    });
  });

  it('maps unknown values without exposing their message', () => {
    const mappedError = mapObjectStorageError('unexpected', 'DELETE');

    expect(mappedError.code).toBe(ObjectStorageErrorCode.UNKNOWN);
    expect(mappedError.message).not.toContain('unexpected');
  });
});
