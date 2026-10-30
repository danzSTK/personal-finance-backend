import {
  AttachmentDimensionsExceededError,
  AttachmentFileTooLargeError,
  UnsupportedAttachmentFileError,
} from '@/modules/transactions/application/errors';
import { TransactionAttachmentImageValidator } from '@/modules/transactions/infrastructure/image-processing/transaction-attachment-image.validator';

jest.mock('sharp', () => {
  return jest.fn();
});

import sharp from 'sharp';
describe('TransactionAttachmentImageValidator', () => {
  let validator: TransactionAttachmentImageValidator;

  beforeEach(() => {
    validator = new TransactionAttachmentImageValidator();
    jest.clearAllMocks();
  });

  it('rejects files larger than 5 MB', async () => {
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);

    await expect(validator.validate(largeBuffer)).rejects.toThrow(AttachmentFileTooLargeError);
  });

  it('rejects unsupported mime types', async () => {
    const buffer = Buffer.from('%PDF-1.7 pdf content here');

    await expect(validator.validate(buffer)).rejects.toThrow(UnsupportedAttachmentFileError);
  });

  it('rejects unrecognized binary files', async () => {
    const buffer = Buffer.from('unknown bytes here');

    await expect(validator.validate(buffer)).rejects.toThrow(UnsupportedAttachmentFileError);
  });

  it('rejects images exceeding 60 Megapixels', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    (sharp as unknown as jest.Mock).mockReturnValue({
      metadata: jest.fn().mockResolvedValue({ width: 8000, height: 8000, format: 'png' }), // 64 MP
    });

    await expect(validator.validate(pngBuffer)).rejects.toThrow(AttachmentDimensionsExceededError);
  });

  it('validates and returns metadata for valid PNG, JPEG, or WebP', async () => {
    const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    (sharp as unknown as jest.Mock).mockReturnValue({
      metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080, format: 'webp' }),
    });

    const result = await validator.validate(webpBuffer);

    expect(result).toEqual({
      contentType: 'image/webp',
      width: 1920,
      height: 1080,
      format: 'webp',
      sizeBytes: webpBuffer.length,
    });
  });
});
