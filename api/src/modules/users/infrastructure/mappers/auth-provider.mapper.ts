import { AuthProvider } from '@/modules/users/domain/entities/auth-provider.entity';
import { AuthProviderFactory } from '@/modules/users/domain/factories/auth-provider.factory';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import { AuthProviderOrmEntity } from '../persistence/auth-provider-orm.entity';

export class AuthProviderMapper {
  static toDomain(entity: AuthProviderOrmEntity): AuthProvider {
    return AuthProviderFactory.create(
      {
        provider: entity.provider,
        providerUserId: entity.providerUserId,
        passwordHash: entity.passwordHash ? HashedPassword.reconstitute(entity.passwordHash) : null,
        userId: entity.user_id,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      },
      entity.id,
    );
  }

  static toOrm(authProvider: AuthProvider, userId: string): Partial<AuthProviderOrmEntity> {
    return {
      id: authProvider.id,
      user_id: userId,
      provider: authProvider.provider,
      providerUserId: authProvider.providerUserId,
      passwordHash: authProvider.passwordHash?.value ?? null,
      created_at: authProvider.createdAt,
      updated_at: authProvider.updatedAt,
    };
  }
}
