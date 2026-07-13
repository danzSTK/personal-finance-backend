import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IUserCacheInvalidator } from './application/ports/user-cache-invalidator.interface';
import { IUserRepository } from './domain/repositories/user.respository.interface';
import { RedisUserCacheInvalidator } from './infrastructure/cache/redis-user-cache-invalidator';
import { AuthProviderOrmEntity } from './infrastructure/persistence/auth-provider-orm.entity';
import { CachedUserRepository } from './infrastructure/persistence/cached-user.repository';
import { UserOrmEntity } from './infrastructure/persistence/user-orm-entity';
import { UserRepository } from './infrastructure/persistence/user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity, AuthProviderOrmEntity])],
  providers: [
    { provide: IUserRepository, useClass: CachedUserRepository },
    { provide: IUserCacheInvalidator, useClass: RedisUserCacheInvalidator },
    UserRepository,
  ],
  exports: [IUserRepository, IUserCacheInvalidator],
})
export class UsersPersistenceModule {}
