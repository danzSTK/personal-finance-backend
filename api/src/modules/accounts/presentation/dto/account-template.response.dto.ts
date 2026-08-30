import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import type { AccountTemplateType } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { ApiProperty } from '@nestjs/swagger';

export class AccountTemplateResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.ACCOUNT_TEMPLATE_ITEM })
  object: typeof RESPONSE_OBJECT_TYPES.ACCOUNT_TEMPLATE_ITEM;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Object.values(ACCOUNT_TEMPLATE_TYPE) })
  type: AccountTemplateType;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  colorToken: string | null;

  @ApiProperty({ nullable: true })
  iconKey: string | null;

  @ApiProperty({ nullable: true, format: 'uri' })
  logoUrl: string | null;

  @ApiProperty({ nullable: true })
  bankCode: number | null;

  @ApiProperty({ nullable: true })
  ispb: string | null;

  static fromDomain(template: AccountTemplate, logoUrl: string | null): AccountTemplateResponseDto {
    return {
      object: RESPONSE_OBJECT_TYPES.ACCOUNT_TEMPLATE_ITEM,
      id: template.id,
      type: template.type,
      name: template.name,
      colorToken: template.colorToken,
      iconKey: template.iconKey,
      logoUrl,
      bankCode: template.bankCode,
      ispb: template.ispb,
    };
  }
}
