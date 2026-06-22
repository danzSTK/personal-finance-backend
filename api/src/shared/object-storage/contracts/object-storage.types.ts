export interface ObjectLocation {
  bucket: string;
  key: string;
}

export interface PutObjectInput extends ObjectLocation {
  body: Uint8Array;
  contentType: string;
  checksumSha256Hex?: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface PutObjectOutput {
  etag: string | null;
  versionId: string | null;
}

export interface StoredObjectMetadata {
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  metadata: Readonly<Record<string, string>>;
}
