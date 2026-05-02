import { IsOptionalButNotNull } from '@/common/decorators/is-optional-but-not-null.decorator';
import { AccountType } from '@/common/models/enums';
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
  @MinLength(3)
  @MaxLength(255)
  name?: string;

  @ApiProperty({ enum: AccountType, example: AccountType.BANK })
  @IsOptionalButNotNull()
  @IsEnum(AccountType)
  type?: AccountType;

  @ApiPropertyOptional({ example: '#a902eb' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string | null;

  @ApiPropertyOptional({ example: 'wallet' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string | null;

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
