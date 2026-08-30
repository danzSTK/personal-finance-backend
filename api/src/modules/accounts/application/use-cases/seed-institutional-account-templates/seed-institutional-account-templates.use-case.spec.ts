/* eslint-disable @typescript-eslint/unbound-method */
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { INSTITUTIONAL_ACCOUNT_TEMPLATES } from '@/modules/accounts/infrastructure/catalog/institutional-account-templates.catalog';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import type { DataSource, EntityManager } from 'typeorm';
import { SeedInstitutionalAccountTemplatesUseCase } from './seed-institutional-account-templates.use-case';

describe('SeedInstitutionalAccountTemplatesUseCase', () => {
  const manager = {} as EntityManager;
  let useCase: SeedInstitutionalAccountTemplatesUseCase;
  let repository: jest.Mocked<IAccountTemplateRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();
    repository = {
      findActiveInstitutionalById: jest.fn(),
      findByIdsForRendering: jest.fn(),
      listActiveInstitutional: jest.fn(),
      findInstitutionalByCatalogKey: jest.fn().mockResolvedValue(null),
      save: jest.fn((template: AccountTemplate): Promise<AccountTemplate> => Promise.resolve(template)),
    };
    const transaction = jest.fn(
      async <T>(callback: (transactionManager: EntityManager) => Promise<T>): Promise<T> => callback(manager),
    );
    const dataSource = { transaction } as unknown as DataSource;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedInstitutionalAccountTemplatesUseCase,
        { provide: IAccountTemplateRepository, useValue: repository },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    useCase = module.get(SeedInstitutionalAccountTemplatesUseCase);
  });

  describe('execute', () => {
    it('persists exactly the ten versioned institutions without network input', async () => {
      await expect(useCase.execute()).resolves.toBe(10);

      expect(repository.save).toHaveBeenCalledTimes(10);
      expect(repository.save.mock.calls.map(([template]) => template.catalogKey)).toEqual(
        INSTITUTIONAL_ACCOUNT_TEMPLATES.map(entry => entry.catalogKey),
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ logoStorageKey: 'banking-institutions-icons/nubank.svg' }),
        { manager },
      );
    });

    it('converges repeated executions by catalog key without changing stable ids', async () => {
      const persisted = new Map<string, AccountTemplate>();
      repository.findInstitutionalByCatalogKey.mockImplementation(catalogKey =>
        Promise.resolve(persisted.get(catalogKey) ?? null),
      );
      repository.save.mockImplementation(template => {
        persisted.set(template.catalogKey!, template);
        return Promise.resolve(template);
      });

      await expect(useCase.execute()).resolves.toBe(10);
      const firstIds = new Map([...persisted].map(([key, template]) => [key, template.id]));
      await expect(useCase.execute()).resolves.toBe(10);

      expect(persisted.size).toBe(10);
      expect(repository.save).toHaveBeenCalledTimes(20);
      expect(new Map([...persisted].map(([key, template]) => [key, template.id]))).toEqual(firstIds);
    });
  });
});
