import { User } from '@/modules/users/domain/entities/user.entity';
import { Email } from '@/modules/users/domain/value-objects/email.value-object';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';
import { AuthProviderOrmEntity } from '../persistence/auth-provider-orm.entity';
import { UserOrmEntity } from '../persistence/user-orm-entity';
import { AuthProviderMapper } from './auth-provider.mapper';

export class UserMapper {
  // ORM -> Domain (Usado no repository ao buscar do banco)
  static toDomain(entity: UserOrmEntity) {
    return User.reconstitute(
      {
        email: Email.create(entity.email),
        userName: entity.userName ? UserName.create(entity.userName) : null,
        firstName: entity.firstName,
        lastName: entity.lastName,
        status: entity.status,
        avatarAssetId: entity.avatarAssetId,
        authProviders: entity.authProviders?.map(ap => AuthProviderMapper.toDomain(ap)) ?? [],
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      },
      entity.id,
    );
  }

  // Dominio -> ORM (usado no repository ao salvar)
  static toOrm(user: User): Partial<UserOrmEntity> {
    return {
      email: user.email.value,
      userName: user.userName?.value ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      avatarAssetId: user.avatarAssetId,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      authProviders: user.authProviders.map(ap => AuthProviderMapper.toOrm(ap, user.id)) as AuthProviderOrmEntity[],
    };
  }
}
