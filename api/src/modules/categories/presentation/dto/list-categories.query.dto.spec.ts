import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListCategoriesQueryDto } from './list-categories.query.dto';

describe('ListCategoriesQueryDto', () => {
  describe('includeArchived', () => {
    it('parses the string false as boolean false', async () => {
      const dto = plainToInstance(
        ListCategoriesQueryDto,
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
        ListCategoriesQueryDto,
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
