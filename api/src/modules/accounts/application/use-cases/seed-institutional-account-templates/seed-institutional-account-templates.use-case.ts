import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { INSTITUTIONAL_ACCOUNT_TEMPLATES } from '@/modules/accounts/infrastructure/catalog/institutional-account-templates.catalog';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class SeedInstitutionalAccountTemplatesUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly accountTemplateRepository: IAccountTemplateRepository,
  ) {}

  async execute(): Promise<number> {
    return this.dataSource.transaction(manager => this.seed(manager));
  }

  private async seed(manager: EntityManager): Promise<number> {
    for (const entry of INSTITUTIONAL_ACCOUNT_TEMPLATES) {
      const existing = await this.accountTemplateRepository.findInstitutionalByCatalogKey(entry.catalogKey, {
        manager,
      });
      const now = new Date();
      const template = AccountTemplate.create(
        {
          type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL,
          ownerUserId: null,
          catalogKey: entry.catalogKey,
          name: entry.name,
          colorToken: entry.colorToken,
          iconKey: null,
          logoStorageKey: entry.storageKey,
          bankCode: entry.bankCode,
          ispb: entry.ispb,
          isActive: existing?.isActive ?? true,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        },
        existing?.id ?? entry.id,
      );

      await this.accountTemplateRepository.save(template, { manager });
    }

    return INSTITUTIONAL_ACCOUNT_TEMPLATES.length;
  }
}
