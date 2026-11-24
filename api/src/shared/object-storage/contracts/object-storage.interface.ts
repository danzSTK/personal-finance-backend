import {
  ObjectLocation,
  PutObjectInput,
  PutObjectOutput,
  SignedUrlOptions,
  SignedUrlOutput,
  StoredObjectMetadata,
} from '@/shared/object-storage/contracts/object-storage.types';

export abstract class IObjectStorage {
  abstract putObject(input: PutObjectInput): Promise<PutObjectOutput>;

  abstract deleteObject(location: ObjectLocation): Promise<void>;

  abstract headObject(location: ObjectLocation): Promise<StoredObjectMetadata | null>;

  abstract buildPublicUrl(location: ObjectLocation): string;

  abstract buildSignedReadUrl(location: ObjectLocation, options?: SignedUrlOptions): Promise<SignedUrlOutput>;

  abstract getObject(location: ObjectLocation): Promise<{ body: Buffer; contentType: string | null }>;
}
