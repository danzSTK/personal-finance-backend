import {
  FiscalNoteAlreadyImportedError,
  TransactionAlreadyHasFiscalNoteError,
} from '@/modules/fiscal-notes/application/errors';
import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports';
import {
  FiscalNoteDbConstraints,
  PG_UNIQUE_VIOLATION_CODE,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { FiscalNoteItem } from '@/modules/fiscal-notes/domain/entities/fiscal-note-item.entity';
import { FiscalNotePayment } from '@/modules/fiscal-notes/domain/entities/fiscal-note-payment.entity';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { randomUUID } from 'node:crypto';
import { QueryFailedError } from 'typeorm';

export function buildFiscalNoteEntityFromParsed(input: {
  userId: string;
  transactionId: string;
  parsed: ParsedFiscalNoteData;
}): FiscalNote {
  const noteId = randomUUID();
  const { parsed } = input;

  return FiscalNote.create(
    {
      id: noteId,
      userId: input.userId,
      transactionId: input.transactionId,
      accessKey: parsed.accessKey,
      sourceUf: parsed.sourceUf,
      number: parsed.number,
      series: parsed.series,
      issuedAt: parsed.issuedAt,
      protocol: parsed.protocol,
      issuerName: parsed.issuerName,
      issuerCnpj: parsed.issuerCnpj,
      issuerAddress: parsed.issuerAddress,
      grossAmountCents: parsed.grossAmountCents,
      discountAmountCents: parsed.discountAmountCents,
      payableAmountCents: parsed.payableAmountCents,
      taxAmountCents: parsed.taxAmountCents,
      changeAmountCents: parsed.changeAmountCents,
      xmlVersion: parsed.xmlVersion,
      xsltVersion: parsed.xsltVersion,
      parserVersion: parsed.parserVersion,
      items: parsed.items.map(item =>
        FiscalNoteItem.create({
          fiscalNoteId: noteId,
          position: item.position,
          rawDescription: item.rawDescription,
          storeCode: item.storeCode,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPriceCents: item.totalPriceCents,
        }),
      ),
      payments: parsed.payments.map(payment =>
        FiscalNotePayment.create({
          fiscalNoteId: noteId,
          position: payment.position,
          methodLabel: payment.methodLabel,
          amountCents: payment.amountCents,
        }),
      ),
    },
    noteId,
  );
}

export async function handleFiscalNoteUniqueConstraintError(input: {
  error: unknown;
  userId: string;
  transactionId: string;
  accessKey: string;
  fiscalNoteRepository: IFiscalNoteRepository;
}): Promise<never> {
  const { error, userId, transactionId, accessKey, fiscalNoteRepository } = input;

  if (error instanceof QueryFailedError) {
    const driverError = (error as QueryFailedError & { driverError?: { code?: string; constraint?: string } })
      .driverError;

    if (driverError?.code === PG_UNIQUE_VIOLATION_CODE) {
      if (driverError.constraint === FiscalNoteDbConstraints.USER_ACCESS_KEY_ACTIVE) {
        const existing = await fiscalNoteRepository.findActiveByUserIdAndAccessKey(userId, accessKey);
        throw new FiscalNoteAlreadyImportedError(existing?.transactionId ?? transactionId, existing?.id ?? '');
      }

      if (driverError.constraint === FiscalNoteDbConstraints.TRANSACTION_ACTIVE) {
        const existing = await fiscalNoteRepository.findActiveByTransactionId(transactionId);
        throw new TransactionAlreadyHasFiscalNoteError(existing?.id ?? '');
      }
    }
  }

  throw error;
}
