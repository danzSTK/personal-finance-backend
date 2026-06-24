import {
  TRANSACTION_LIST_DEFAULT_LIMIT,
  TRANSACTION_LIST_DEFAULT_PAGE,
  TRANSACTION_LIST_MAX_LIMIT,
} from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

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
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-06-30' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  dateTo?: string;

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
}
