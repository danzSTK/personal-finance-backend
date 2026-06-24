import { ListTransactionsUseCaseOutput } from '@/modules/transactions/application/use-cases/list-transactions/list-transactions.dto';
import { ApiProperty } from '@nestjs/swagger';
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

export class ListTransactionsResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  data: TransactionResponseDto[];

  @ApiProperty({ type: ListTransactionsMetaDto })
  meta: ListTransactionsMetaDto;

  static fromUseCaseOutput(output: ListTransactionsUseCaseOutput): ListTransactionsResponseDto {
    return {
      data: output.items.map(transaction => TransactionResponseDto.fromDomain(transaction)),
      meta: {
        total: output.total,
        page: output.page,
        limit: output.limit,
        totalPages: output.totalPages,
        hasNextPage: output.hasNextPage,
        hasPreviousPage: output.hasPreviousPage,
      },
    };
  }
}
