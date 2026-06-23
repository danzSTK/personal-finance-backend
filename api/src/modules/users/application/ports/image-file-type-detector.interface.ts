export interface DetectedImageFileType {
  mime: string;
  extension: string;
}

export abstract class IImageFileTypeDetector {
  abstract detect(input: Uint8Array): Promise<DetectedImageFileType | null>;
}
