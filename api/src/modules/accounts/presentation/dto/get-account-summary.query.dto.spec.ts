import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetAccountSummaryQueryDto } from './get-account-summary.query.dto';

describe('GetAccountSummaryQueryDto', () => {
  describe('account set filters', () => {
    it('parses string false values as boolean false', async () => {
      const dto = plainToInstance(
        GetAccountSummaryQueryDto,
        {
          includeArchived: 'false',
          includeExcludedFromTotal: 'false',
        },
        { enableImplicitConversion: true },
      );

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.includeArchived).toBe(false);
      expect(dto.includeExcludedFromTotal).toBe(false);
    });

    it('parses string true values as boolean true', async () => {
      const dto = plainToInstance(
        GetAccountSummaryQueryDto,
        {
          includeArchived: 'true',
          includeExcludedFromTotal: 'true',
        },
        { enableImplicitConversion: true },
      );

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.includeArchived).toBe(true);
      expect(dto.includeExcludedFromTotal).toBe(true);
    });
  });
});
