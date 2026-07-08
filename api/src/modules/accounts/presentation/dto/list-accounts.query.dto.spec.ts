import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListAccountsQueryDto } from './list-accounts.query.dto';

describe('ListAccountsQueryDto', () => {
  describe('includeArchived', () => {
    it('parses the string false as boolean false', async () => {
      const dto = plainToInstance(
        ListAccountsQueryDto,
        {
          includeArchived: 'false',
        },
        { enableImplicitConversion: true },
      );

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.includeArchived).toBe(false);
    });

    it('parses the string true as boolean true', async () => {
      const dto = plainToInstance(
        ListAccountsQueryDto,
        {
          includeArchived: 'true',
        },
        { enableImplicitConversion: true },
      );

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.includeArchived).toBe(true);
    });
  });
});
