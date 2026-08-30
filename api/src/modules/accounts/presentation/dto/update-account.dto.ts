import { IsOptionalButNotNull } from '@/common/decorators/is-optional-but-not-null.decorator';
import { ACCOUNT_NAME_MAX_LENGTH, ACCOUNT_NAME_MIN_LENGTH } from '@/common/models/constants';
import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountResponseDto } from '@/modules/accounts/presentation/dto/account.response.dto';
import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { parseBooleanTransformValue } from '@/common/utils/parse-boolean-query-param';
import {
  AccountTemplateInputDto,
  CustomAccountTemplateInputDto,
  InstitutionalAccountTemplateInputDto,
} from '@/modules/accounts/presentation/dto/account-template-input.dto';

@ApiExtraModels(InstitutionalAccountTemplateInputDto, CustomAccountTemplateInputDto)
export class UpdateAccountDto {
  @ApiPropertyOptional({
    description: 'Identidade visual nova; incompatível com color/icon legados.',
    oneOf: [
      { $ref: getSchemaPath(InstitutionalAccountTemplateInputDto) },
      { $ref: getSchemaPath(CustomAccountTemplateInputDto) },
    ],
    discriminator: {
      propertyName: 'type',
      mapping: {
        institutional: getSchemaPath(InstitutionalAccountTemplateInputDto),
        custom: getSchemaPath(CustomAccountTemplateInputDto),
      },
    },
  })
  @IsOptionalButNotNull()
  @ValidateNested()
  @Type(() => AccountTemplateInputDto, {
    discriminator: {
      property: 'type',
      subTypes: [
        { value: InstitutionalAccountTemplateInputDto, name: 'institutional' },
        { value: CustomAccountTemplateInputDto, name: 'custom' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  template?: InstitutionalAccountTemplateInputDto | CustomAccountTemplateInputDto;

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

  @ApiPropertyOptional({ enum: ColorToken, example: ColorToken.BLUE, deprecated: true })
  @IsOptional()
  @IsEnum(ColorToken)
  color?: ColorToken | null;

  @ApiPropertyOptional({ enum: IconKey, example: IconKey.WALLET, deprecated: true })
  @IsOptional()
  @IsEnum(IconKey)
  icon?: IconKey | null;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptionalButNotNull()
  @Transform(parseBooleanTransformValue)
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
