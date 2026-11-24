import { TRANSACTION_ATTACHMENT_MAX_INPUT_BYTES } from '@/common/models/constants';
import {
  AttachmentDimensionsExceededError,
  AttachmentFileTooLargeError,
  UnsupportedAttachmentFileError,
} from '@/modules/transactions/application/errors';
import { TransactionAttachmentImageValidator } from '@/modules/transactions/infrastructure/image-processing/transaction-attachment-image.validator';
import { IFileSignatureDetector } from '@/shared/file-detection';

jest.mock('sharp', () => {
  return jest.fn();
});

import sharp from 'sharp';

describe('TransactionAttachmentImageValidator', () => {
  let detect: jest.MockedFunction<IFileSignatureDetector['detect']>;
  let validator: TransactionAttachmentImageValidator;

  beforeEach(() => {
    detect = jest.fn();
    validator = new TransactionAttachmentImageValidator({ detect });
    jest.clearAllMocks();
  });

  it('rejects files larger than 5 MB', async () => {
    const largeBuffer = Buffer.alloc(TRANSACTION_ATTACHMENT_MAX_INPUT_BYTES + 1);

    await expect(validator.validate(largeBuffer)).rejects.toThrow(AttachmentFileTooLargeError);
    expect(detect).not.toHaveBeenCalled();
  });

  it('rejects unsupported mime types', async () => {
    detect.mockResolvedValue({ mime: 'application/pdf', extension: 'pdf' });
    const buffer = Buffer.from('%PDF-1.7 pdf content here');

    await expect(validator.validate(buffer)).rejects.toThrow(UnsupportedAttachmentFileError);
  });

  it('rejects unrecognized binary files', async () => {
    detect.mockResolvedValue(null);
    const buffer = Buffer.from('unknown bytes here');

    await expect(validator.validate(buffer)).rejects.toThrow(UnsupportedAttachmentFileError);
  });

  it('rejects when signature detector throws', async () => {
    detect.mockRejectedValue(new Error('corrupt stream'));
    const buffer = Buffer.from('corrupt');

    await expect(validator.validate(buffer)).rejects.toThrow(UnsupportedAttachmentFileError);
  });

  it('rejects images exceeding 60 Megapixels', async () => {
    detect.mockResolvedValue({ mime: 'image/png', extension: 'png' });
    const pngBuffer = Buffer.from('fake-png');
    (sharp as unknown as jest.Mock).mockReturnValue({
      metadata: jest.fn().mockResolvedValue({ width: 8000, height: 8000, format: 'png' }), // 64 MP
    });

    await expect(validator.validate(pngBuffer)).rejects.toThrow(AttachmentDimensionsExceededError);
  });

  it('validates and returns metadata for valid PNG, JPEG, or WebP', async () => {
    detect.mockResolvedValue({ mime: 'image/webp', extension: 'webp' });
    const webpBuffer = Buffer.from('fake-webp');
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

  it('falls back to detected extension when sharp metadata format is undefined', async () => {
    detect.mockResolvedValue({ mime: 'image/jpeg', extension: 'jpg' });
    const jpegBuffer = Buffer.from('fake-jpeg');
    (sharp as unknown as jest.Mock).mockReturnValue({
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600 }),
    });

    const result = await validator.validate(jpegBuffer);

    expect(result).toEqual({
      contentType: 'image/jpeg',
      width: 800,
      height: 600,
      format: 'jpg',
      sizeBytes: jpegBuffer.length,
    });
  });
});
