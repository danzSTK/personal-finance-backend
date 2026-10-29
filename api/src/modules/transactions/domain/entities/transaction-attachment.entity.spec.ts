import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';
import { InvalidAttachmentPositionError } from '@/modules/transactions/domain/errors';

describe('TransactionAttachment', () => {
  const transactionId = '11111111-1111-4111-a111-111111111111';
  const assetId = '22222222-2222-4222-a222-222222222222';

  it('creates an attachment with valid position (0 to 2)', () => {
    const attachment = TransactionAttachment.create({
      transactionId,
      assetId,
      position: 0,
    });

    expect(attachment.id).toBeDefined();
    expect(attachment.transactionId).toBe(transactionId);
    expect(attachment.assetId).toBe(assetId);
    expect(attachment.position).toBe(0);
    expect(attachment.createdAt).toBeInstanceOf(Date);
    expect(attachment.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects position less than 0', () => {
    expect(() =>
      TransactionAttachment.create({
        transactionId,
        assetId,
        position: -1,
      }),
    ).toThrow(InvalidAttachmentPositionError);
  });

  it('rejects position greater than 2', () => {
    expect(() =>
      TransactionAttachment.create({
        transactionId,
        assetId,
        position: 3,
      }),
    ).toThrow(InvalidAttachmentPositionError);
  });

  it('rejects non-integer position', () => {
    expect(() =>
      TransactionAttachment.create({
        transactionId,
        assetId,
        position: 1.5,
      }),
    ).toThrow(InvalidAttachmentPositionError);
  });

  it('changes position successfully', () => {
    const attachment = TransactionAttachment.create({
      transactionId,
      assetId,
      position: 0,
    });

    attachment.changePosition(2);
    expect(attachment.position).toBe(2);
  });

  it('rejects changing to an invalid position', () => {
    const attachment = TransactionAttachment.create({
      transactionId,
      assetId,
      position: 0,
    });

    expect(() => attachment.changePosition(5)).toThrow(InvalidAttachmentPositionError);
  });

  it('reconstitutes an existing attachment', () => {
    const now = new Date();
    const attachment = TransactionAttachment.reconstitute({
      id: '33333333-3333-4333-a333-333333333333',
      transactionId,
      assetId,
      position: 1,
      createdAt: now,
      updatedAt: now,
    });

    expect(attachment.id).toBe('33333333-3333-4333-a333-333333333333');
    expect(attachment.position).toBe(1);
  });
});
