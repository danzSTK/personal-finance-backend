import { ColorToken, IconKey } from '@/common/models/enums';
import { projectAccountTemplateToLegacyVisual } from '@/modules/accounts/application/models/account-template-legacy-visual';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { InstitutionalAccountTemplateColorToken } from '@/modules/accounts/domain/value-objects/account-template-color-token.value-object';

describe('projectAccountTemplateToLegacyVisual', () => {
  it.each([
    ['nubank', ColorToken.PURPLE],
    ['inter', ColorToken.ORANGE],
    ['itau', ColorToken.BLUE],
    ['bradesco', ColorToken.RED],
    ['santander', ColorToken.RED],
    ['banco-do-brasil', ColorToken.YELLOW],
    ['caixa', ColorToken.SKY],
    ['c6', ColorToken.ZINC],
    ['picpay', ColorToken.GREEN],
    ['mercado-pago', ColorToken.BLUE],
  ] satisfies ReadonlyArray<readonly [InstitutionalAccountTemplateColorToken, ColorToken]>)(
    'projects %s to the legacy ColorToken %s',
    (institutionalColor, expectedLegacyColor) => {
      const template = institutionalTemplate(institutionalColor);

      expect(projectAccountTemplateToLegacyVisual(template)).toEqual({
        color: expectedLegacyColor,
        icon: IconKey.LANDMARK,
      });
    },
  );
});

function institutionalTemplate(colorToken: InstitutionalAccountTemplateColorToken): AccountTemplate {
  const now = new Date('2026-08-29T00:00:00.000Z');

  return AccountTemplate.reconstitute(
    {
      type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL,
      ownerUserId: null,
      catalogKey: colorToken,
      name: colorToken,
      colorToken,
      iconKey: null,
      logoStorageKey: `banking-institutions-icons/${colorToken}.svg`,
      bankCode: 260,
      ispb: '18236120',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    '54066cca-075e-4300-923b-f5b36462aa1f',
  );
}
