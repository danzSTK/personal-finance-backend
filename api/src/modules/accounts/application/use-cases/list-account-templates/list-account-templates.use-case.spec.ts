/* eslint-disable @typescript-eslint/unbound-method */
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { ListAccountTemplatesUseCase } from './list-account-templates.use-case';

describe('ListAccountTemplatesUseCase', () => {
  let useCase: ListAccountTemplatesUseCase;
  let repository: jest.Mocked<IAccountTemplateRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();
    repository = {
      findActiveInstitutionalById: jest.fn(),
      findByIdsForRendering: jest.fn(),
      listActiveInstitutional: jest.fn().mockResolvedValue([]),
      findInstitutionalByCatalogKey: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListAccountTemplatesUseCase, { provide: IAccountTemplateRepository, useValue: repository }],
    }).compile();

    useCase = module.get(ListAccountTemplatesUseCase);
  });

  describe('execute', () => {
    it('delegates to the active institutional catalog query exactly once', async () => {
      await expect(useCase.execute()).resolves.toEqual([]);

      expect(repository.listActiveInstitutional).toHaveBeenCalledTimes(1);
      expect(repository.findByIdsForRendering).not.toHaveBeenCalled();
    });
  });
});
