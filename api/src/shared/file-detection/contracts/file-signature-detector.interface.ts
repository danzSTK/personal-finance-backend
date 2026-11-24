export interface DetectedFileSignature {
  mime: string;
  extension: string;
}

export abstract class IFileSignatureDetector {
  abstract detect(input: Uint8Array): Promise<DetectedFileSignature | null>;
}
