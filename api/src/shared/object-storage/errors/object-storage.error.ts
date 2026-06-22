export enum ObjectStorageErrorCode {
  ACCESS_DENIED = 'OBJECT_STORAGE_ACCESS_DENIED',
  BUCKET_NOT_FOUND = 'OBJECT_STORAGE_BUCKET_NOT_FOUND',
  INVALID_REQUEST = 'OBJECT_STORAGE_INVALID_REQUEST',
  PUBLIC_URL_UNAVAILABLE = 'OBJECT_STORAGE_PUBLIC_URL_UNAVAILABLE',
  RATE_LIMITED = 'OBJECT_STORAGE_RATE_LIMITED',
  TIMEOUT = 'OBJECT_STORAGE_TIMEOUT',
  UNAVAILABLE = 'OBJECT_STORAGE_UNAVAILABLE',
  UNKNOWN = 'OBJECT_STORAGE_UNKNOWN',
}

export type ObjectStorageOperation = 'PUT' | 'HEAD' | 'DELETE' | 'BUILD_PUBLIC_URL';

interface ObjectStorageErrorInput {
  code: ObjectStorageErrorCode;
  operation: ObjectStorageOperation;
  retryable: boolean;
  statusCode?: number;
  requestId?: string;
  attempts?: number;
  cause?: unknown;
}

export class ObjectStorageError extends Error {
  public readonly code: ObjectStorageErrorCode;
  public readonly operation: ObjectStorageOperation;
  public readonly retryable: boolean;
  public readonly statusCode?: number;
  public readonly requestId?: string;
  public readonly attempts?: number;

  constructor(input: ObjectStorageErrorInput) {
    super(`Object Storage ${input.operation} failed with ${input.code}.`, { cause: input.cause });
    this.name = new.target.name;
    this.code = input.code;
    this.operation = input.operation;
    this.retryable = input.retryable;
    this.statusCode = input.statusCode;
    this.requestId = input.requestId;
    this.attempts = input.attempts;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
