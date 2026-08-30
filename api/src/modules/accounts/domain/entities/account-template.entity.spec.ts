import { ColorToken, IconKey } from '@/common/models/enums';
import { InvalidAccountTemplateError } from '@/modules/accounts/domain/errors';
import { AccountTemplate } from './account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '../enums/account-template-type.enum';

describe('AccountTemplate', () => {
  const now = new Date('2020-01-01T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a global institutional template with curated metadata', () => {
      const template = AccountTemplate.create(
        {
          type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL,
          ownerUserId: null,
          catalogKey: 'nubank',
          name: 'Nubank',
          colorToken: 'nubank',
          iconKey: null,
          logoStorageKey: 'banking-institutions-icons/nubank.svg',
          bankCode: 260,
          ispb: '18236120',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        '2ab28159-d4e6-41b0-ab28-728b9b6a8f9c',
      );

      expect(template.type).toBe(ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL);
      expect(template.ownerUserId).toBeNull();
      expect(template.logoStorageKey).toBe('banking-institutions-icons/nubank.svg');
      expect(template.bankCode).toBe(260);
      expect(template.ispb).toBe('18236120');
    });

    it('creates a private custom template without institutional metadata', () => {
      const template = AccountTemplate.create(
        {
          type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
          ownerUserId: '7959495d-7c8a-451d-b308-da032c20e615',
          catalogKey: null,
          name: 'Conta principal',
          colorToken: ColorToken.PURPLE,
          iconKey: IconKey.LANDMARK,
          logoStorageKey: null,
          bankCode: null,
          ispb: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        '5587ab92-a853-4409-b3c7-a23f72652b18',
      );

      expect(template.type).toBe(ACCOUNT_TEMPLATE_TYPE.CUSTOM);
      expect(template.ownerUserId).toBe('7959495d-7c8a-451d-b308-da032c20e615');
      expect(template.iconKey).toBe(IconKey.LANDMARK);
      expect(template.logoStorageKey).toBeNull();
    });

    it.each([
      {
        label: 'institutional owner',
        patch: { ownerUserId: '7959495d-7c8a-451d-b308-da032c20e615' },
      },
      { label: 'missing institutional catalog key', patch: { catalogKey: null } },
      { label: 'unsafe storage key', patch: { logoStorageKey: '/nubank.svg' } },
      { label: 'invalid ISPB', patch: { ispb: '123' } },
    ])('rejects $label', ({ patch }) => {
      expect(() =>
        AccountTemplate.create(
          {
            type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL,
            ownerUserId: null,
            catalogKey: 'nubank',
            name: 'Nubank',
            colorToken: 'nubank',
            iconKey: null,
            logoStorageKey: 'banking-institutions-icons/nubank.svg',
            bankCode: 260,
            ispb: '18236120',
            isActive: true,
            createdAt: now,
            updatedAt: now,
            ...patch,
          },
          '2ab28159-d4e6-41b0-ab28-728b9b6a8f9c',
        ),
      ).toThrow(InvalidAccountTemplateError);
    });

    it('rejects institutional metadata in a custom template', () => {
      expect(() =>
        AccountTemplate.create(
          {
            type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
            ownerUserId: '7959495d-7c8a-451d-b308-da032c20e615',
            catalogKey: 'nubank',
            name: 'Conta principal',
            colorToken: ColorToken.PURPLE,
            iconKey: IconKey.LANDMARK,
            logoStorageKey: null,
            bankCode: null,
            ispb: null,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
          '5587ab92-a853-4409-b3c7-a23f72652b18',
        ),
      ).toThrow(InvalidAccountTemplateError);
    });
  });

  describe('updateCustomVisualIdentity', () => {
    it('updates only a custom template owned by the account user', () => {
      const template = AccountTemplate.reconstitute(
        {
          type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
          ownerUserId: '7959495d-7c8a-451d-b308-da032c20e615',
          catalogKey: null,
          name: 'Conta principal',
          colorToken: null,
          iconKey: null,
          logoStorageKey: null,
          bankCode: null,
          ispb: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        '5587ab92-a853-4409-b3c7-a23f72652b18',
      );

      template.updateCustomVisualIdentity({
        ownerUserId: '7959495d-7c8a-451d-b308-da032c20e615',
        name: 'Conta atualizada',
        colorToken: ColorToken.BLUE,
        iconKey: IconKey.WALLET,
      });

      expect(template.name).toBe('Conta atualizada');
      expect(template.colorToken).toBe(ColorToken.BLUE);
      expect(template.iconKey).toBe(IconKey.WALLET);
      expect(template.updatedAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
