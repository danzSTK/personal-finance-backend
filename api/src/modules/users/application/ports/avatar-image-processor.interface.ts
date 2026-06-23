export interface ProcessedAvatarImage {
  bytes: Uint8Array;
  contentType: 'image/webp';
  sizeBytes: number;
  checksum: string;
  metadata: {
    width: number;
    height: number;
    format: 'webp';
  };
}

export abstract class IAvatarImageProcessor {
  abstract process(input: Uint8Array): Promise<ProcessedAvatarImage>;
}
