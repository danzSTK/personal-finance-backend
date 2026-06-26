import { IsDateOnly } from '@/common/decorators/is-date-only.decorator';
import {
  TRANSACTION_LIST_DEFAULT_LIMIT,
  TRANSACTION_LIST_DEFAULT_PAGE,
  TRANSACTION_LIST_DEFAULT_SORT,
  TRANSACTION_LIST_MAX_LIMIT,
  TRANSACTION_LIST_SORT_VALUES,
} from '@/common/models/constants';
import type { TransactionListSort } from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import type { DateOnlyString } from '@/common/utils/date-only';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-06-01' })
  @IsDateOnly()
  @IsOptional()
  dateFrom?: DateOnlyString;

  @ApiPropertyOptional({ format: 'date', example: '2026-06-30' })
  @IsDateOnly()
  @IsOptional()
  dateTo?: DateOnlyString;

  @ApiPropertyOptional({ example: TRANSACTION_LIST_DEFAULT_PAGE, default: TRANSACTION_LIST_DEFAULT_PAGE })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: TRANSACTION_LIST_DEFAULT_LIMIT, default: TRANSACTION_LIST_DEFAULT_LIMIT })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TRANSACTION_LIST_MAX_LIMIT)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    enum: TRANSACTION_LIST_SORT_VALUES,
    default: TRANSACTION_LIST_DEFAULT_SORT,
    example: TRANSACTION_LIST_DEFAULT_SORT,
  })
  @IsIn([...TRANSACTION_LIST_SORT_VALUES])
  @IsOptional()
  sort?: TransactionListSort;
}
