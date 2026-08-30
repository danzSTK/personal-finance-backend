import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { AccountTemplateMapper } from '@/modules/accounts/infrastructure/mappers/account-template.mapper';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccountTemplateOrmEntity } from './account-template-orm.entity';

@Injectable()
export class AccountTemplateRepository implements IAccountTemplateRepository {
  constructor(
    @InjectRepository(AccountTemplateOrmEntity)
    private readonly repository: Repository<AccountTemplateOrmEntity>,
  ) {}

  async findActiveInstitutionalById(templateId: string, options?: IRepositoryOptions): Promise<AccountTemplate | null> {
    const repository = this.resolveRepository(options);
    const entity = await repository.findOne({
      where: {
        id: templateId,
        template_type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL,
        is_active: true,
      },
    });

    return entity ? AccountTemplateMapper.toDomain(entity) : null;
  }

  async findByIdsForRendering(
    templateIds: readonly string[],
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<AccountTemplate[]> {
    if (templateIds.length === 0) {
      return [];
    }

    const repository = this.resolveRepository(options);
    const entities = await repository.find({
      where: [
        { id: In([...templateIds]), template_type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL },
        { id: In([...templateIds]), template_type: ACCOUNT_TEMPLATE_TYPE.CUSTOM, owner_user_id: userId },
      ],
    });

    return entities.map(entity => AccountTemplateMapper.toDomain(entity));
  }

  async listActiveInstitutional(options?: IRepositoryOptions): Promise<AccountTemplate[]> {
    const entities = await this.resolveRepository(options).find({
      where: {
        template_type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL,
        is_active: true,
      },
      order: { name: 'ASC' },
    });

    return entities.map(entity => AccountTemplateMapper.toDomain(entity));
  }

  async findInstitutionalByCatalogKey(
    catalogKey: string,
    options?: IRepositoryOptions,
  ): Promise<AccountTemplate | null> {
    const entity = await this.resolveRepository(options).findOne({
      where: {
        template_type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL,
        catalog_key: catalogKey,
      },
    });

    return entity ? AccountTemplateMapper.toDomain(entity) : null;
  }

  async save(template: AccountTemplate, options?: IRepositoryOptions): Promise<AccountTemplate> {
    const repository = this.resolveRepository(options);
    await repository.save(AccountTemplateMapper.toOrm(template));
    const saved = await repository.findOneByOrFail({ id: template.id });
    return AccountTemplateMapper.toDomain(saved);
  }

  private resolveRepository(options?: IRepositoryOptions): Repository<AccountTemplateOrmEntity> {
    return options?.manager ? options.manager.getRepository(AccountTemplateOrmEntity) : this.repository;
  }
}
