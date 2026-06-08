import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ACCOUNT_NAME_MAX_LENGTH, ACCOUNT_NAME_MIN_LENGTH } from '@/common/models/constants';
import { AccountType, ColorToken, IconKey } from '@/common/models/enums';

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

  @ApiPropertyOptional({ example: 1000.5, default: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  initialBalance?: number;

  @ApiPropertyOptional({ enum: ColorToken, example: ColorToken.BLUE })
  @IsOptional()
  @IsEnum(ColorToken)
  color?: ColorToken | null;

  @ApiPropertyOptional({ enum: IconKey, example: IconKey.WALLET })
  @IsOptional()
  @IsEnum(IconKey)
  icon?: IconKey | null;

  @ApiPropertyOptional({ example: true, default: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeInTotal?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
