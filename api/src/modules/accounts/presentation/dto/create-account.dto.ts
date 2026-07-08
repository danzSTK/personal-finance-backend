import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ACCOUNT_NAME_MAX_LENGTH, ACCOUNT_NAME_MIN_LENGTH } from '@/common/models/constants';
import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { Transform } from 'class-transformer';
import { parseBooleanTransformValue } from '@/common/utils/parse-boolean-query-param';

export class CreateAccountDto {
  @ApiProperty({ example: 'Conta principal' })
  @IsString()
  @IsNotEmpty()
  @MinLength(ACCOUNT_NAME_MIN_LENGTH)
  @MaxLength(ACCOUNT_NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.BANK })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ example: 100050, default: 0, description: 'Saldo inicial em centavos' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  initialBalanceCents?: number;

  @ApiPropertyOptional({ enum: ColorToken, example: ColorToken.BLUE })
  @IsOptional()
  @IsEnum(ColorToken)
  color?: ColorToken | null;

  @ApiPropertyOptional({ enum: IconKey, example: IconKey.WALLET })
  @IsOptional()
  @IsEnum(IconKey)
  icon?: IconKey | null;

  @ApiPropertyOptional({ example: true, default: true })
  @Transform(parseBooleanTransformValue)
  @IsBoolean()
  @IsOptional()
  includeInTotal?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @Transform(parseBooleanTransformValue)
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
