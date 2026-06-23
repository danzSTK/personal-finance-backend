import { IsOptionalButNotNull } from '@/common/decorators/is-optional-but-not-null.decorator';
import { ACCOUNT_NAME_MAX_LENGTH, ACCOUNT_NAME_MIN_LENGTH } from '@/common/models/constants';
import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountResponseDto } from '@/modules/accounts/presentation/dto/account.response.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAccountDto {
  @ApiProperty({ example: 'Conta principal' })
  @IsOptionalButNotNull()
  @IsString()
  @IsNotEmpty()
  @MinLength(ACCOUNT_NAME_MIN_LENGTH)
  @MaxLength(ACCOUNT_NAME_MAX_LENGTH)
  name?: string;

  @ApiProperty({ enum: AccountType, example: AccountType.BANK })
  @IsOptionalButNotNull()
  @IsEnum(AccountType)
  type?: AccountType;

  @ApiPropertyOptional({ enum: ColorToken, example: ColorToken.BLUE })
  @IsOptional()
  @IsEnum(ColorToken)
  color?: ColorToken | null;

  @ApiPropertyOptional({ enum: IconKey, example: IconKey.WALLET })
  @IsOptional()
  @IsEnum(IconKey)
  icon?: IconKey | null;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptionalButNotNull()
  @Type(() => Boolean)
  @IsBoolean()
  includeInTotal?: boolean;

  static fromDomain(account: Account): AccountResponseDto {
    const dto = new AccountResponseDto();

    dto.name = account.name;
    dto.type = account.type;
    dto.color = account.color;
    dto.icon = account.icon;
    dto.includeInTotal = account.includeInTotal;
    return dto;
  }
}
