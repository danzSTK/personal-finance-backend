import { ApiController } from '@/app/api/api.controller';
import { CommonModule } from '@/common/common.module';
import { AppExceptionFilter } from '@/common/filters';
import { ConfigModule } from '@/config/config.module';
import throttleConfig from '@/config/throttle.config';
import { PostgresModule } from '@/database/postgres/postgres.module';
import { RedisModule } from '@/database/redis/redis.module';
import { RedisService } from '@/database/redis/redis.service';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { AssetsModule } from '@/modules/assets/assets.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { UsersModule } from '@/modules/users/users.module';
import { JobsModule } from '@/shared/jobs/jobs.module';
import { OutboxModule } from '@/shared/outbox';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from '@/modules/health/health.module';
import { EmailVerificationStatusGuard } from '@/shared/guards/email-verification-status.guard';
import { JwtAuthGuard } from '@/shared/guards/jwt-auth.guard';
import { OriginGuard } from '@/shared/guards/origin.guard';
import { SessionModule } from '@/shared/session-tracking/session-metadata.module';

@Module({
  imports: [
    ConfigModule,
    PostgresModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [throttleConfig.KEY, RedisService],
      useFactory: (throttlerConfig: ConfigType<typeof throttleConfig>, redisService: RedisService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: throttlerConfig.default.ttl ?? 60000,
            limit: throttlerConfig.default.limit ?? 20,
          },
        ],
        storage: new ThrottlerStorageRedisService(redisService.getClient()),
      }),
    }),
    RedisModule,
    JobsModule,
    OutboxModule,
    UsersModule,
    AuthModule,
    CommonModule,
    SessionModule,
    HealthModule,
    AccountsModule,
    AssetsModule,
    CategoriesModule,
    TransactionsModule,
    NotificationsModule,
  ],
  controllers: [ApiController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EmailVerificationStatusGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class ApiModule {}
