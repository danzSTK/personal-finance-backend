import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { ApiProperty } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  accountId: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  destinationAccountId: string | null;

  @ApiProperty({ format: 'uuid' })
  categoryId: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  type: TransactionType;

  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.EFFECTIVE })
  status: TransactionStatus;

  @ApiProperty({ example: 1920, description: 'Valor absoluto em centavos' })
  amountCents: number;

  @ApiProperty({ format: 'date', example: '2026-06-23' })
  date: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  effectiveAt: Date | null;

  @ApiProperty({ nullable: true, example: 'Mercado da semana' })
  description: string | null;

  @ApiProperty({ enum: TransactionDirection, nullable: true, example: TransactionDirection.DECREASE })
  direction: TransactionDirection | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  static fromDomain(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      accountId: transaction.accountId,
      destinationAccountId: transaction.destinationAccountId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      status: transaction.status,
      amountCents: transaction.amountCents,
      date: transaction.date,
      effectiveAt: transaction.effectiveAt,
      description: transaction.description,
      direction: transaction.direction,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}
