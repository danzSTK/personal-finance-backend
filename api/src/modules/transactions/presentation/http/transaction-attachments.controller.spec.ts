/* eslint-disable @typescript-eslint/unbound-method */
import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { AddTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/add-transaction-attachments/add-transaction-attachments.use-case';
import { DeleteTransactionAttachmentUseCase } from '@/modules/transactions/application/use-cases/delete-transaction-attachment/delete-transaction-attachment.use-case';
import { ListTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/list-transaction-attachments/list-transaction-attachments.use-case';
import { ReorderTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/reorder-transaction-attachments/reorder-transaction-attachments.use-case';
import { TransactionAttachmentsController } from '@/modules/transactions/presentation/http/transaction-attachments.controller';
import { User } from '@/modules/users/domain/entities/user.entity';
import { BadRequestException } from '@nestjs/common';

describe('TransactionAttachmentsController', () => {
  const user = { id: '11111111-1111-4111-a111-111111111111' } as unknown as User;
  const transactionId = '22222222-2222-4222-a222-222222222222';
  const attachmentItem = {
    id: '33333333-3333-4333-a333-333333333333',
    assetId: '44444444-4444-4444-a444-444444444444',
    position: 0,
    contentType: 'image/webp',
    sizeBytes: 2048,
    url: 'https://signed.r2.cloudflarestorage.com/file',
    expiresAt: new Date('2026-11-24T19:00:00.000Z'),
    cacheMaxAgeSeconds: 240,
  };

  let controller: TransactionAttachmentsController;
  let addUseCase: jest.Mocked<AddTransactionAttachmentsUseCase>;
  let listUseCase: jest.Mocked<ListTransactionAttachmentsUseCase>;
  let deleteUseCase: jest.Mocked<DeleteTransactionAttachmentUseCase>;
  let reorderUseCase: jest.Mocked<ReorderTransactionAttachmentsUseCase>;

  beforeEach(() => {
    addUseCase = { execute: jest.fn() } as unknown as jest.Mocked<AddTransactionAttachmentsUseCase>;
    listUseCase = { execute: jest.fn() } as unknown as jest.Mocked<ListTransactionAttachmentsUseCase>;
    deleteUseCase = { execute: jest.fn() } as unknown as jest.Mocked<DeleteTransactionAttachmentUseCase>;
    reorderUseCase = { execute: jest.fn() } as unknown as jest.Mocked<ReorderTransactionAttachmentsUseCase>;

    controller = new TransactionAttachmentsController(addUseCase, listUseCase, deleteUseCase, reorderUseCase);
  });

  it('throws BadRequestException when no files are uploaded', async () => {
    await expect(controller.addAttachments(user, transactionId, [])).rejects.toThrow(BadRequestException);
    await expect(controller.addAttachments(user, transactionId, undefined)).rejects.toThrow(BadRequestException);
    expect(addUseCase.execute).not.toHaveBeenCalled();
  });

  it('delegates uploaded files to AddTransactionAttachmentsUseCase and adds object discriminator', async () => {
    const file = {
      buffer: Buffer.from('img'),
      originalname: 'receipt.png',
    } as Express.Multer.File;
    addUseCase.execute.mockResolvedValue([attachmentItem]);

    const result = await controller.addAttachments(user, transactionId, [file]);

    expect(addUseCase.execute).toHaveBeenCalledWith({
      userId: user.id,
      transactionId,
      files: [{ buffer: file.buffer, originalname: 'receipt.png' }],
    });
    expect(result).toEqual([
      {
        object: RESPONSE_OBJECT_TYPES.TRANSACTION_ATTACHMENT_ITEM,
        ...attachmentItem,
      },
    ]);
  });

  it('maps listed attachments with object discriminator', async () => {
    listUseCase.execute.mockResolvedValue([attachmentItem]);

    const result = await controller.listAttachments(user, transactionId);

    expect(listUseCase.execute).toHaveBeenCalledWith({
      userId: user.id,
      transactionId,
    });
    expect(result).toEqual([
      {
        object: RESPONSE_OBJECT_TYPES.TRANSACTION_ATTACHMENT_ITEM,
        ...attachmentItem,
      },
    ]);
  });
});
