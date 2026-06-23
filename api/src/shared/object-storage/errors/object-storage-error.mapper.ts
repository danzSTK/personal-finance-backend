import {
  ObjectStorageError,
  ObjectStorageErrorCode,
  ObjectStorageOperation,
} from '@/shared/object-storage/errors/object-storage.error';
import { S3ServiceException } from '@aws-sdk/client-s3';

const TIMEOUT_ERROR_NAMES = new Set(['AbortError', 'RequestTimeout', 'TimeoutError']);
const TIMEOUT_ERROR_CODES = new Set(['ETIMEDOUT', 'ESOCKETTIMEDOUT']);
const UNAVAILABLE_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
]);

export function isObjectNotFoundError(error: unknown): boolean {
  if (!(error instanceof S3ServiceException) || error.name === 'NoSuchBucket') {
    return false;
  }

  return error.name === 'NotFound' || error.name === 'NoSuchKey' || error.$metadata.httpStatusCode === 404;
}

export function mapObjectStorageError(error: unknown, operation: ObjectStorageOperation): ObjectStorageError {
  if (error instanceof ObjectStorageError) {
    return error;
  }

  if (error instanceof S3ServiceException) {
    const statusCode = error.$metadata.httpStatusCode;

    return new ObjectStorageError({
      code: mapServiceErrorCode(error.name, statusCode),
      operation,
      retryable: isRetryableServiceError(error, statusCode),
      statusCode,
      requestId: error.$metadata.requestId,
      attempts: error.$metadata.attempts,
      cause: error,
    });
  }

  const nodeErrorCode = getNodeErrorCode(error);
  const errorName = error instanceof Error ? error.name : undefined;

  if ((errorName && TIMEOUT_ERROR_NAMES.has(errorName)) || (nodeErrorCode && TIMEOUT_ERROR_CODES.has(nodeErrorCode))) {
    return new ObjectStorageError({
      code: ObjectStorageErrorCode.TIMEOUT,
      operation,
      retryable: true,
      cause: error,
    });
  }

  if (nodeErrorCode && UNAVAILABLE_ERROR_CODES.has(nodeErrorCode)) {
    return new ObjectStorageError({
      code: ObjectStorageErrorCode.UNAVAILABLE,
      operation,
      retryable: true,
      cause: error,
    });
  }

  return new ObjectStorageError({
    code: ObjectStorageErrorCode.UNKNOWN,
    operation,
    retryable: false,
    cause: error,
  });
}

function mapServiceErrorCode(name: string, statusCode?: number): ObjectStorageErrorCode {
  if (name === 'AccessDenied' || statusCode === 401 || statusCode === 403) {
    return ObjectStorageErrorCode.ACCESS_DENIED;
  }

  if (name === 'NoSuchBucket') {
    return ObjectStorageErrorCode.BUCKET_NOT_FOUND;
  }

  if (name === 'InvalidRequest' || statusCode === 400 || statusCode === 409 || statusCode === 412) {
    return ObjectStorageErrorCode.INVALID_REQUEST;
  }

  if (statusCode === 429) {
    return ObjectStorageErrorCode.RATE_LIMITED;
  }

  if (statusCode !== undefined && statusCode >= 500) {
    return ObjectStorageErrorCode.UNAVAILABLE;
  }

  return ObjectStorageErrorCode.UNKNOWN;
}

function isRetryableServiceError(error: S3ServiceException, statusCode?: number): boolean {
  return Boolean(error.$retryable) || statusCode === 429 || (statusCode !== undefined && statusCode >= 500);
}

function getNodeErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('code' in error)) {
    return undefined;
  }

  const code = error.code;

  return typeof code === 'string' ? code : undefined;
}
