import { IsDateOnly } from '@/common/decorators/is-date-only.decorator';
import { TRANSACTION_AMOUNT_CENTS_MAX } from '@/common/models/constants';
import type { DateOnlyString } from '@/common/utils/date-only';
import {
  FISCAL_NOTE_CNPJ_REGEX,
  FISCAL_NOTE_LIST_DEFAULT_LIMIT,
  FISCAL_NOTE_LIST_DEFAULT_PAGE,
  FISCAL_NOTE_LIST_DEFAULT_SORT,
  FISCAL_NOTE_LIST_MAX_LIMIT,
  FISCAL_NOTE_LIST_SEARCH_MAX_LENGTH,
  FISCAL_NOTE_LIST_SORT_VALUES,
  FISCAL_NOTE_UF_REGEX,
  type FiscalNoteListSort,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

function extractRawQueryValue({ obj, key, value }: TransformFnParams): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }

  return value;
}

function toOptionalTrimmedString(params: TransformFnParams): unknown {
  const rawValue = extractRawQueryValue(params);
  if (typeof rawValue !== 'string') {
    return rawValue;
  }

  const trimmed = rawValue.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function toOptionalCnpjDigits(params: TransformFnParams): unknown {
  const rawValue = extractRawQueryValue(params);
  if (typeof rawValue !== 'string') {
    return rawValue;
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.replace(/[.\s/-]/g, '');
}

function toOptionalNumberQueryParam(params: TransformFnParams): unknown {
  const rawValue = extractRawQueryValue(params);
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    return trimmed.length === 0 ? undefined : Number(trimmed);
  }

  if (typeof rawValue === 'number') {
    return rawValue;
  }

  return rawValue;
}

export class ListFiscalNotesQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    example: '2026-10-01',
    description: 'Data civil inicial de emissão (YYYY-MM-DD, fuso -03:00)',
  })
  @IsDateOnly()
  @IsOptional()
  issuedFrom?: DateOnlyString;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-10-31',
    description: 'Data civil final de emissão (YYYY-MM-DD, fuso -03:00)',
  })
  @IsDateOnly()
  @IsOptional()
  issuedTo?: DateOnlyString;

  @ApiPropertyOptional({
    example: '03539462000250',
    description: 'CNPJ do emitente (14 dígitos ou formatado com ./- e espaços)',
  })
  @Transform(toOptionalCnpjDigits)
  @IsString()
  @Matches(FISCAL_NOTE_CNPJ_REGEX)
  @IsOptional()
  issuerCnpj?: string;

  @ApiPropertyOptional({
    example: '23',
    description: 'Código IBGE de 2 dígitos da UF emissora',
  })
  @Transform(toOptionalTrimmedString)
  @IsString()
  @Matches(FISCAL_NOTE_UF_REGEX)
  @IsOptional()
  sourceUf?: string;

  @ApiPropertyOptional({
    example: 1000,
    minimum: 0,
    description: 'Valor mínimo a pagar em centavos (>= 0)',
  })
  @Transform(toOptionalNumberQueryParam)
  @IsInt()
  @Min(0)
  @Max(TRANSACTION_AMOUNT_CENTS_MAX)
  @IsOptional()
  minAmountCents?: number;

  @ApiPropertyOptional({
    example: 50000,
    minimum: 0,
    description: 'Valor máximo a pagar em centavos (>= 0)',
  })
  @Transform(toOptionalNumberQueryParam)
  @IsInt()
  @Min(0)
  @Max(TRANSACTION_AMOUNT_CENTS_MAX)
  @IsOptional()
  maxAmountCents?: number;

  @ApiPropertyOptional({
    example: 'QUEIJO',
    maxLength: FISCAL_NOTE_LIST_SEARCH_MAX_LENGTH,
    description: 'Busca textual case-insensitive no nome do emitente ou na descrição dos itens',
  })
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(FISCAL_NOTE_LIST_SEARCH_MAX_LENGTH)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    example: FISCAL_NOTE_LIST_DEFAULT_PAGE,
    default: FISCAL_NOTE_LIST_DEFAULT_PAGE,
    minimum: 1,
    description: 'Número da página (>= 1)',
  })
  @Transform(toOptionalNumberQueryParam)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    example: FISCAL_NOTE_LIST_DEFAULT_LIMIT,
    default: FISCAL_NOTE_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: FISCAL_NOTE_LIST_MAX_LIMIT,
    description: `Itens por página (1..${FISCAL_NOTE_LIST_MAX_LIMIT})`,
  })
  @Transform(toOptionalNumberQueryParam)
  @IsInt()
  @Min(1)
  @Max(FISCAL_NOTE_LIST_MAX_LIMIT)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    enum: FISCAL_NOTE_LIST_SORT_VALUES,
    default: FISCAL_NOTE_LIST_DEFAULT_SORT,
    example: FISCAL_NOTE_LIST_DEFAULT_SORT,
    description: 'Campo e direção de ordenação allowlisted',
  })
  @IsIn([...FISCAL_NOTE_LIST_SORT_VALUES])
  @IsOptional()
  sort?: FiscalNoteListSort;
}
