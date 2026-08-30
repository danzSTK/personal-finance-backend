import { isColorToken } from '@/common/models/constants';
import { ColorToken, IconKey } from '@/common/models/enums';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import {
  InstitutionalAccountTemplateColorToken,
  isInstitutionalAccountTemplateColorToken,
} from '@/modules/accounts/domain/value-objects/account-template-color-token.value-object';

const INSTITUTIONAL_LEGACY_COLOR_TOKENS = {
  nubank: ColorToken.PURPLE,
  inter: ColorToken.ORANGE,
  itau: ColorToken.BLUE,
  bradesco: ColorToken.RED,
  santander: ColorToken.RED,
  'banco-do-brasil': ColorToken.YELLOW,
  caixa: ColorToken.SKY,
  c6: ColorToken.ZINC,
  picpay: ColorToken.GREEN,
  'mercado-pago': ColorToken.BLUE,
} as const satisfies Record<InstitutionalAccountTemplateColorToken, ColorToken>;

export interface LegacyAccountVisual {
  color: ColorToken | null;
  icon: IconKey | null;
}

export function projectAccountTemplateToLegacyVisual(template: AccountTemplate): LegacyAccountVisual {
  if (template.type === ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL) {
    const institutionalColor = template.colorToken;

    return {
      color:
        institutionalColor !== null && isInstitutionalAccountTemplateColorToken(institutionalColor)
          ? INSTITUTIONAL_LEGACY_COLOR_TOKENS[institutionalColor]
          : ColorToken.SLATE,
      icon: IconKey.LANDMARK,
    };
  }

  return {
    color: template.colorToken !== null && isColorToken(template.colorToken) ? template.colorToken : null,
    icon: template.iconKey,
  };
}
