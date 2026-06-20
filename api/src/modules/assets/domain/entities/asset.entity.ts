import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { InvalidAssetError, InvalidAssetStateTransitionError } from '@/modules/assets/domain/errors';
import { StorageKey } from '@/modules/assets/domain/value-objects';

export interface AssetMetadata {
  width?: number;
  height?: number;
  format?: string;
}

export interface AssetProps {
  userId: string;
  purpose: AssetPurpose;
  status: AssetStatus;
  bucket: string;
  storageKey: StorageKey;
  contentType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  metadata: AssetMetadata;
  failureCode: string | null;
  readyAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePendingAssetProps {
  userId: string;
  purpose: AssetPurpose;
  bucket: string;
  storageKey: StorageKey;
}

export interface MarkAssetReadyProps {
  contentType: string;
  sizeBytes: number;
  checksum: string;
  metadata?: AssetMetadata;
}

export class Asset {
  private constructor(
    private readonly props: AssetProps,
    public readonly id: string,
  ) {}

  get userId(): string {
    return this.props.userId;
  }

  get purpose(): AssetPurpose {
    return this.props.purpose;
  }

  get status(): AssetStatus {
    return this.props.status;
  }

  get bucket(): string {
    return this.props.bucket;
  }

  get storageKey(): string {
    return this.props.storageKey.value;
  }

  get contentType(): string | null {
    return this.props.contentType;
  }

  get sizeBytes(): number | null {
    return this.props.sizeBytes;
  }

  get checksum(): string | null {
    return this.props.checksum;
  }

  get metadata(): Readonly<AssetMetadata> {
    return { ...this.props.metadata };
  }

  get failureCode(): string | null {
    return this.props.failureCode;
  }

  get readyAt(): Date | null {
    return this.props.readyAt ? new Date(this.props.readyAt) : null;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt ? new Date(this.props.deletedAt) : null;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  static createPendingUpload(props: CreatePendingAssetProps, id: string): Asset {
    Asset.validateIdentity(id, 'id');
    Asset.validateIdentity(props.userId, 'userId');
    Asset.validateBucket(props.bucket);

    const now = new Date();

    return new Asset(
      {
        ...props,
        status: AssetStatus.PENDING_UPLOAD,
        contentType: null,
        sizeBytes: null,
        checksum: null,
        metadata: {},
        failureCode: null,
        readyAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      id,
    );
  }

  static reconstitute(props: AssetProps, id: string): Asset {
    return new Asset(props, id);
  }

  markReady(props: MarkAssetReadyProps): void {
    this.ensureStatus(AssetStatus.PENDING_UPLOAD);
    Asset.validateReadyData(props);

    const now = new Date();

    this.props.status = AssetStatus.READY;
    this.props.contentType = props.contentType.trim();
    this.props.sizeBytes = props.sizeBytes;
    this.props.checksum = props.checksum;
    this.props.metadata = { ...props.metadata };
    this.props.failureCode = null;
    this.props.readyAt = now;
    this.props.updatedAt = now;
  }

  markDeletePending(): void {
    if (this.props.status !== AssetStatus.READY && this.props.status !== AssetStatus.FAILED) {
      throw new InvalidAssetStateTransitionError(`Cannot mark an asset with status ${this.props.status} for deletion.`);
    }

    this.props.status = AssetStatus.DELETE_PENDING;
    this.props.failureCode = null;
    this.props.updatedAt = new Date();
  }

  markDeleted(): void {
    this.ensureStatus(AssetStatus.DELETE_PENDING);

    const now = new Date();

    this.props.status = AssetStatus.DELETED;
    this.props.deletedAt = now;
    this.props.updatedAt = now;
  }

  markFailed(failureCode: string): void {
    this.ensureStatus(AssetStatus.PENDING_UPLOAD);

    const normalizedFailureCode = failureCode.trim();

    if (!normalizedFailureCode) {
      throw new InvalidAssetError('Asset failure code cannot be empty.');
    }

    this.props.status = AssetStatus.FAILED;
    this.props.failureCode = normalizedFailureCode;
    this.props.updatedAt = new Date();
  }

  private ensureStatus(expectedStatus: AssetStatus): void {
    if (this.props.status !== expectedStatus) {
      throw new InvalidAssetStateTransitionError(
        `Expected asset status ${expectedStatus}, received ${this.props.status}.`,
      );
    }
  }

  private static validateReadyData(props: MarkAssetReadyProps): void {
    if (!props.contentType.trim()) {
      throw new InvalidAssetError('Asset content type cannot be empty.');
    }

    if (!Number.isSafeInteger(props.sizeBytes) || props.sizeBytes < 0) {
      throw new InvalidAssetError('Asset size must be a non-negative safe integer.');
    }

    if (!/^[0-9a-f]{64}$/.test(props.checksum)) {
      throw new InvalidAssetError('Asset checksum must be a lowercase SHA-256 value.');
    }

    if (
      props.metadata?.width !== undefined &&
      (!Number.isSafeInteger(props.metadata.width) || props.metadata.width <= 0)
    ) {
      throw new InvalidAssetError('Asset metadata width must be a positive integer.');
    }

    if (
      props.metadata?.height !== undefined &&
      (!Number.isSafeInteger(props.metadata.height) || props.metadata.height <= 0)
    ) {
      throw new InvalidAssetError('Asset metadata height must be a positive integer.');
    }
  }

  private static validateIdentity(value: string, field: string): void {
    if (!value.trim()) {
      throw new InvalidAssetError(`Asset ${field} cannot be empty.`);
    }
  }

  private static validateBucket(bucket: string): void {
    if (!bucket.trim()) {
      throw new InvalidAssetError('Asset bucket cannot be empty.');
    }
  }
}
