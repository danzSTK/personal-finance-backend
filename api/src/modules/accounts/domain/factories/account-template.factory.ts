import { ColorToken, IconKey } from '@/common/models/enums';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { randomUUID } from 'node:crypto';

export interface CreateCustomAccountTemplateInput {
  ownerUserId: string;
  name: string;
  colorToken: ColorToken | null;
  iconKey: IconKey | null;
}

export class AccountTemplateFactory {
  static createCustom(input: CreateCustomAccountTemplateInput): AccountTemplate {
    const now = new Date();

    return AccountTemplate.create(
      {
        type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
        ownerUserId: input.ownerUserId,
        catalogKey: null,
        name: input.name,
        colorToken: input.colorToken,
        iconKey: input.iconKey,
        logoStorageKey: null,
        bankCode: null,
        ispb: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      randomUUID(),
    );
  }
}
