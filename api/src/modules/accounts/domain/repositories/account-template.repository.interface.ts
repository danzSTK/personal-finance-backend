import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';

export abstract class IAccountTemplateRepository {
  abstract findActiveInstitutionalById(
    templateId: string,
    options?: IRepositoryOptions,
  ): Promise<AccountTemplate | null>;
  abstract findByIdsForRendering(
    templateIds: readonly string[],
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<AccountTemplate[]>;
  abstract listActiveInstitutional(options?: IRepositoryOptions): Promise<AccountTemplate[]>;
  abstract findInstitutionalByCatalogKey(
    catalogKey: string,
    options?: IRepositoryOptions,
  ): Promise<AccountTemplate | null>;
  abstract save(template: AccountTemplate, options?: IRepositoryOptions): Promise<AccountTemplate>;
}
