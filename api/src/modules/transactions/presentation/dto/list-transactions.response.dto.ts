import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ListTransactionsUseCaseOutput } from '@/modules/transactions/application/use-cases/list-transactions/list-transactions.dto';
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { TransactionResponseDto } from './transaction.response.dto';

class ListTransactionsMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  hasPreviousPage: boolean;
}

class ListTransactionsSummaryAmountDto {
  @ApiProperty({ example: 120000 })
  pendingCents: number;

  @ApiProperty({ example: 300000 })
  effectiveCents: number;

  @ApiProperty({ example: 420000 })
  totalCents: number;
}

class ListTransactionsTypeSummaryDto extends ListTransactionsSummaryAmountDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.TRANSACTION_SUMMARY_TYPE })
  object: typeof RESPONSE_OBJECT_TYPES.TRANSACTION_SUMMARY_TYPE;
}

class ListTransactionsBalanceSummaryDto {
  @ApiProperty({ example: 40000 })
  pendingDeltaCents: number;

  @ApiProperty({ example: 150000 })
  effectiveDeltaCents: number;

  @ApiProperty({ example: 190000 })
  expectedBalanceCents: number;
}

class ListTransactionsGroupedSummaryDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.TRANSACTION_SUMMARY_OVERVIEW })
  object: typeof RESPONSE_OBJECT_TYPES.TRANSACTION_SUMMARY_OVERVIEW;

  @ApiProperty({ type: ListTransactionsSummaryAmountDto })
  income: ListTransactionsSummaryAmountDto;

  @ApiProperty({ type: ListTransactionsSummaryAmountDto })
  expense: ListTransactionsSummaryAmountDto;

  @ApiProperty({ type: ListTransactionsBalanceSummaryDto })
  balance: ListTransactionsBalanceSummaryDto;
}

@ApiExtraModels(ListTransactionsTypeSummaryDto, ListTransactionsGroupedSummaryDto)
export class ListTransactionsResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.TRANSACTION_LIST })
  object: typeof RESPONSE_OBJECT_TYPES.TRANSACTION_LIST;

  @ApiProperty({ type: [TransactionResponseDto] })
  data: TransactionResponseDto[];

  @ApiProperty({ type: ListTransactionsMetaDto })
  meta: ListTransactionsMetaDto;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ListTransactionsTypeSummaryDto) },
      { $ref: getSchemaPath(ListTransactionsGroupedSummaryDto) },
    ],
  })
  summary: ListTransactionsTypeSummaryDto | ListTransactionsGroupedSummaryDto;

  static fromUseCaseOutput(output: ListTransactionsUseCaseOutput): ListTransactionsResponseDto {
    return {
      object: RESPONSE_OBJECT_TYPES.TRANSACTION_LIST,
      data: output.items.map(transaction => TransactionResponseDto.fromDomain(transaction)),
      meta: {
        total: output.total,
        page: output.page,
        limit: output.limit,
        totalPages: output.totalPages,
        hasNextPage: output.hasNextPage,
        hasPreviousPage: output.hasPreviousPage,
      },
      summary:
        'income' in output.summary
          ? {
              object: RESPONSE_OBJECT_TYPES.TRANSACTION_SUMMARY_OVERVIEW,
              ...output.summary,
            }
          : {
              object: RESPONSE_OBJECT_TYPES.TRANSACTION_SUMMARY_TYPE,
              ...output.summary,
            },
    };
  }
}
