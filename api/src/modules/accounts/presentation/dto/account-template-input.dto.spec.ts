import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { CreateAccountDto } from '@/modules/accounts/presentation/dto/create-account.dto';
import { UpdateAccountDto } from '@/modules/accounts/presentation/dto/update-account.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Account template request DTOs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CreateAccountDto', () => {
    it('accepts the institutional branch with a UUID reference', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        name: 'Conta Nubank',
        type: AccountType.BANK,
        template: {
          type: 'institutional',
          templateId: '54066cca-075e-4300-923b-f5b36462aa1f',
        },
      });

      await expect(validateDto(dto)).resolves.toHaveLength(0);
    });

    it('accepts the custom branch with visual tokens', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        name: 'Conta pessoal',
        type: AccountType.BANK,
        template: {
          type: 'custom',
          colorToken: ColorToken.BLUE,
          iconKey: IconKey.WALLET,
        },
      });

      await expect(validateDto(dto)).resolves.toHaveLength(0);
    });

    it('rejects institutional-only fields in the custom branch', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        name: 'Conta pessoal',
        type: AccountType.BANK,
        template: {
          type: 'custom',
          templateId: '54066cca-075e-4300-923b-f5b36462aa1f',
        },
      });

      await expect(validateDto(dto)).resolves.not.toHaveLength(0);
    });

    it('rejects an unknown discriminator', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        name: 'Conta pessoal',
        type: AccountType.BANK,
        template: { type: 'admin-defined' },
      });

      await expect(validateDto(dto)).resolves.not.toHaveLength(0);
    });

    it('rejects a null template object', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        name: 'Conta pessoal',
        type: AccountType.BANK,
        template: null,
      });

      await expect(validateDto(dto)).resolves.not.toHaveLength(0);
    });
  });

  describe('UpdateAccountDto', () => {
    it('accepts a partial custom visual patch', async () => {
      const dto = plainToInstance(UpdateAccountDto, {
        template: {
          type: 'custom',
          colorToken: ColorToken.PURPLE,
        },
      });

      await expect(validateDto(dto)).resolves.toHaveLength(0);
    });
  });
});

function validateDto(dto: object) {
  return validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}
