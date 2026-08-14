import { IPasswordChangeStateStore } from '@/modules/auth/application/ports/password-change-state-store.interface';
import { PasswordChangeStateAssembler } from '@/modules/auth/application/services/password-change-state.assembler';
import { PasswordChangeStateLoader } from '@/modules/auth/application/services/password-change-state-loader';
import { PasswordChangeStateSynchronizer } from '@/modules/auth/application/services/password-change-state-synchronizer';
import { ChangePasswordPolicy } from '@/modules/auth/domain/policies/change-password.policy';
import { IPasswordChangeEventRepository } from '@/modules/auth/domain/repositories/password-change-event.repository.interface';
import { RedisPasswordChangeStateStore } from '@/modules/auth/infrastructure/cache/redis-password-change-state-store';
import { PasswordChangeEventOrmEntity } from '@/modules/auth/infrastructure/persistence/password-change-event-orm.entity';
import { PasswordChangeEventRepository } from '@/modules/auth/infrastructure/persistence/password-change-event.repository';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([PasswordChangeEventOrmEntity])],
  providers: [
    {
      provide: IPasswordChangeEventRepository,
      useClass: PasswordChangeEventRepository,
    },
    {
      provide: IPasswordChangeStateStore,
      useClass: RedisPasswordChangeStateStore,
    },
    PasswordChangeStateAssembler,
    PasswordChangeStateLoader,
    PasswordChangeStateSynchronizer,
    ChangePasswordPolicy,
  ],
  exports: [
    IPasswordChangeEventRepository,
    IPasswordChangeStateStore,
    PasswordChangeStateAssembler,
    PasswordChangeStateLoader,
    PasswordChangeStateSynchronizer,
    ChangePasswordPolicy,
  ],
})
export class AuthPasswordChangeCoreModule {}
