import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';
import { RedisSessionRepository } from '@/modules/auth/infrastructure/persistence/redis-session.repository';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: ISessionRepository,
      useClass: RedisSessionRepository,
    },
  ],
  exports: [ISessionRepository],
})
export class AuthSessionCoreModule {}
