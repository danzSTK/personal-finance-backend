import { USER_AVATAR_HEIGHT, USER_AVATAR_MAX_INPUT_BYTES, USER_AVATAR_WIDTH } from '@/common/models/constants';
import { AvatarFileTooLargeError, UnsupportedAvatarFileError } from '@/modules/users/application/errors';
import { IImageFileTypeDetector } from '@/modules/users/application/ports/image-file-type-detector.interface';
import { SharpAvatarImageProcessor } from '@/modules/users/infrastructure/image-processing/sharp-avatar.image.processor';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

describe('SharpAvatarImageProcessor', () => {
  let detect: jest.MockedFunction<IImageFileTypeDetector['detect']>;
  let processor: SharpAvatarImageProcessor;

  beforeEach(() => {
    detect = jest.fn().mockResolvedValue({ mime: 'image/png', extension: 'png' });
    processor = new SharpAvatarImageProcessor({ detect });
  });

  it('normalizes an accepted image to a square webp', async () => {
    const input = await sharp({
      create: {
        width: 64,
        height: 32,
        channels: 3,
        background: '#336699',
      },
    })
      .png()
      .toBuffer();

    const result = await processor.process(input);

    expect(result.contentType).toBe('image/webp');
    expect(result.metadata).toEqual({
      width: USER_AVATAR_WIDTH,
      height: USER_AVATAR_HEIGHT,
      format: 'webp',
    });
    expect(result.checksum).toBe(createHash('sha256').update(result.bytes).digest('hex'));
  });

  it('rejects input larger than the configured limit', async () => {
    const input = new Uint8Array(USER_AVATAR_MAX_INPUT_BYTES + 1);

    await expect(processor.process(input)).rejects.toBeInstanceOf(AvatarFileTooLargeError);
  });

  it('rejects bytes with an unsupported signature', async () => {
    detect.mockResolvedValue({ mime: 'application/pdf', extension: 'pdf' });
    const input = Buffer.from('%PDF-1.7 invalid avatar');

    await expect(processor.process(input)).rejects.toBeInstanceOf(UnsupportedAvatarFileError);
  });
});
