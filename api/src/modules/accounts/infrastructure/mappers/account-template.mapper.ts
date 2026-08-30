import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { AccountTemplateOrmEntity } from '@/modules/accounts/infrastructure/persistence/account-template-orm.entity';

export class AccountTemplateMapper {
  static toDomain(entity: AccountTemplateOrmEntity): AccountTemplate {
    return AccountTemplate.reconstitute(
      {
        type: entity.template_type,
        ownerUserId: entity.owner_user_id,
        catalogKey: entity.catalog_key,
        name: entity.name,
        colorToken: entity.color_token,
        iconKey: entity.icon_key,
        logoStorageKey: entity.logo_storage_key,
        bankCode: entity.bank_code,
        ispb: entity.ispb,
        isActive: entity.is_active,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      },
      entity.id,
    );
  }

  static toOrm(template: AccountTemplate): Partial<AccountTemplateOrmEntity> {
    return {
      id: template.id,
      template_type: template.type,
      owner_user_id: template.ownerUserId,
      catalog_key: template.catalogKey,
      name: template.name,
      color_token: template.colorToken,
      icon_key: template.iconKey,
      logo_storage_key: template.logoStorageKey,
      bank_code: template.bankCode,
      ispb: template.ispb,
      is_active: template.isActive,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    };
  }
}
