import { ACCOUNT_TEMPLATE_INPUT_TYPE } from '@/modules/accounts/application/models/account-template-input';
import { ColorToken, IconKey } from '@/common/models/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

export class AccountTemplateInputDto {
  @IsIn(Object.values(ACCOUNT_TEMPLATE_INPUT_TYPE))
  type: string;
}

export class InstitutionalAccountTemplateInputDto extends AccountTemplateInputDto {
  @ApiProperty({
    enum: [ACCOUNT_TEMPLATE_INPUT_TYPE.INSTITUTIONAL],
    example: ACCOUNT_TEMPLATE_INPUT_TYPE.INSTITUTIONAL,
  })
  @IsIn([ACCOUNT_TEMPLATE_INPUT_TYPE.INSTITUTIONAL])
  type: typeof ACCOUNT_TEMPLATE_INPUT_TYPE.INSTITUTIONAL = ACCOUNT_TEMPLATE_INPUT_TYPE.INSTITUTIONAL;

  @ApiProperty({ format: 'uuid', description: 'Referência de um template institucional ativo.' })
  @IsUUID()
  templateId: string;
}

export class CustomAccountTemplateInputDto extends AccountTemplateInputDto {
  @ApiProperty({ enum: [ACCOUNT_TEMPLATE_INPUT_TYPE.CUSTOM], example: ACCOUNT_TEMPLATE_INPUT_TYPE.CUSTOM })
  @IsIn([ACCOUNT_TEMPLATE_INPUT_TYPE.CUSTOM])
  type: typeof ACCOUNT_TEMPLATE_INPUT_TYPE.CUSTOM = ACCOUNT_TEMPLATE_INPUT_TYPE.CUSTOM;

  @ApiPropertyOptional({ enum: ColorToken, example: ColorToken.BLUE, nullable: true })
  @IsOptional()
  @IsEnum(ColorToken)
  colorToken?: ColorToken | null;

  @ApiPropertyOptional({ enum: IconKey, example: IconKey.WALLET, nullable: true })
  @IsOptional()
  @IsEnum(IconKey)
  iconKey?: IconKey | null;
}
