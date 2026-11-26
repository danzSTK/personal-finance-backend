import { FiscalNoteItem } from '@/modules/fiscal-notes/domain/entities/fiscal-note-item.entity';
import { FiscalNotePayment } from '@/modules/fiscal-notes/domain/entities/fiscal-note-payment.entity';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { InvalidFiscalNoteError } from '@/modules/fiscal-notes/domain/errors';
import { FiscalNoteItemOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-item-orm.entity';
import { FiscalNoteOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-orm.entity';
import { FiscalNotePaymentOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-payment-orm.entity';

export class FiscalNoteMapper {
  static toDomain(entity: FiscalNoteOrmEntity): FiscalNote {
    const items = (entity.items ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(item => FiscalNoteMapper.toItemDomain(item));

    const payments = (entity.payments ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(payment => FiscalNoteMapper.toPaymentDomain(payment));

    return FiscalNote.reconstitute(
      {
        userId: entity.userId,
        transactionId: entity.transactionId,
        accessKey: entity.accessKey.trim(),
        sourceUf: entity.sourceUf.trim(),
        number: entity.number,
        series: entity.series,
        issuedAt: entity.issuedAt,
        protocol: entity.protocol,
        issuerName: entity.issuerName,
        issuerCnpj: entity.issuerCnpj.trim(),
        issuerAddress: entity.issuerAddress,
        grossAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(entity.grossAmountCents, 'grossAmountCents'),
        discountAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(entity.discountAmountCents, 'discountAmountCents'),
        payableAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(entity.payableAmountCents, 'payableAmountCents'),
        taxAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(entity.taxAmountCents, 'taxAmountCents'),
        changeAmountCents:
          entity.changeAmountCents === null
            ? null
            : FiscalNoteMapper.toSafeNonNegativeCents(entity.changeAmountCents, 'changeAmountCents'),
        xmlVersion: entity.xmlVersion,
        xsltVersion: entity.xsltVersion,
        parserVersion: entity.parserVersion,
        items,
        payments,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        deletedAt: entity.deletedAt,
      },
      entity.id,
    );
  }

  static toItemDomain(entity: FiscalNoteItemOrmEntity): FiscalNoteItem {
    return FiscalNoteItem.reconstitute(
      {
        fiscalNoteId: entity.fiscalNoteId,
        position: entity.position,
        rawDescription: entity.rawDescription,
        storeCode: entity.storeCode,
        unit: entity.unit,
        quantity: FiscalNoteMapper.toPositiveDecimal(entity.quantity, 'quantity'),
        unitPrice: FiscalNoteMapper.toNonNegativeDecimal(entity.unitPrice, 'unitPrice'),
        totalPriceCents: FiscalNoteMapper.toSafeNonNegativeCents(entity.totalPriceCents, 'totalPriceCents'),
        createdAt: entity.createdAt,
      },
      entity.id,
    );
  }

  static toPaymentDomain(entity: FiscalNotePaymentOrmEntity): FiscalNotePayment {
    return FiscalNotePayment.reconstitute(
      {
        fiscalNoteId: entity.fiscalNoteId,
        position: entity.position,
        methodLabel: entity.methodLabel,
        amountCents: FiscalNoteMapper.toSafeNonNegativeCents(entity.amountCents, 'amountCents'),
        createdAt: entity.createdAt,
      },
      entity.id,
    );
  }

  static toOrm(
    fiscalNote: FiscalNote,
  ): Partial<Omit<FiscalNoteOrmEntity, 'user' | 'transaction' | 'items' | 'payments'>> {
    return {
      id: fiscalNote.id,
      userId: fiscalNote.userId,
      transactionId: fiscalNote.transactionId,
      accessKey: fiscalNote.accessKey,
      sourceUf: fiscalNote.sourceUf,
      number: fiscalNote.number,
      series: fiscalNote.series,
      issuedAt: fiscalNote.issuedAt,
      protocol: fiscalNote.protocol,
      issuerName: fiscalNote.issuerName,
      issuerCnpj: fiscalNote.issuerCnpj,
      issuerAddress: fiscalNote.issuerAddress,
      grossAmountCents: String(fiscalNote.grossAmountCents),
      discountAmountCents: String(fiscalNote.discountAmountCents),
      payableAmountCents: String(fiscalNote.payableAmountCents),
      taxAmountCents: String(fiscalNote.taxAmountCents),
      changeAmountCents: fiscalNote.changeAmountCents === null ? null : String(fiscalNote.changeAmountCents),
      xmlVersion: fiscalNote.xmlVersion,
      xsltVersion: fiscalNote.xsltVersion,
      parserVersion: fiscalNote.parserVersion,
      createdAt: fiscalNote.createdAt,
      updatedAt: fiscalNote.updatedAt,
      deletedAt: fiscalNote.deletedAt,
    };
  }

  static toItemOrm(item: FiscalNoteItem): Partial<Omit<FiscalNoteItemOrmEntity, 'fiscalNote'>> {
    return {
      id: item.id,
      fiscalNoteId: item.fiscalNoteId,
      position: item.position,
      rawDescription: item.rawDescription,
      storeCode: item.storeCode,
      unit: item.unit,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      totalPriceCents: String(item.totalPriceCents),
      createdAt: item.createdAt,
    };
  }

  static toPaymentOrm(payment: FiscalNotePayment): Partial<Omit<FiscalNotePaymentOrmEntity, 'fiscalNote'>> {
    return {
      id: payment.id,
      fiscalNoteId: payment.fiscalNoteId,
      position: payment.position,
      methodLabel: payment.methodLabel,
      amountCents: String(payment.amountCents),
      createdAt: payment.createdAt,
    };
  }

  private static toSafeNonNegativeCents(raw: string, field: string): number {
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new InvalidFiscalNoteError(`Persisted fiscal note ${field} is invalid.`);
    }

    return parsed;
  }

  private static toPositiveDecimal(raw: string, field: string): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new InvalidFiscalNoteError(`Persisted fiscal note ${field} is invalid.`);
    }

    return parsed;
  }

  private static toNonNegativeDecimal(raw: string, field: string): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new InvalidFiscalNoteError(`Persisted fiscal note ${field} is invalid.`);
    }

    return parsed;
  }
}
