import { AppController } from '@/app/app.controller';
import { AppService } from '@/app/app.service';
import { CommonModule } from '@/common/common.module';
import { AppExceptionFilter } from '@/common/filters';
import { ConfigModule } from '@/config/config.module';
import { ENTITIES } from '@/config/entities';
import throttleConfig from '@/config/throttle.config';
import { RedisModule } from '@/database/redis/redis.module';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { AssetsModule } from '@/modules/assets/assets.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { UsersModule } from '@/modules/users/users.module';
import { AppEventsModule } from '@/shared/events';
import { JobsModule } from '@/shared/jobs/jobs.module';
import { OutboxModule } from '@/shared/outbox';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppStatus } from '../common/models/enums';
import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import { RedisService } from '../database/redis/redis.service';
import { HealthModule } from '../modules/health/health.module';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { OriginGuard } from '../shared/guards/origin.guard';
import { SessionModule } from '../shared/session-tracking/session-metadata.module';
import { OutboxRehydratorsModule } from './composition/outbox-rehydrators.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (dbConfig: ConfigType<typeof databaseConfig>, app: ConfigType<typeof appConfig>) => ({
        type: 'postgres',
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.dbName,
        entities: ENTITIES,
        synchronize: false,
        logging: true,
        ssl: (app.nodeEnv as AppStatus) === AppStatus.PRODUCTION ? { rejectUnauthorized: false } : false,
      }),
      inject: [databaseConfig.KEY, appConfig.KEY],
    }),
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
    AppEventsModule,
    OutboxModule,
    OutboxRehydratorsModule,
    UsersModule,
    AuthModule,
    CommonModule,
    SessionModule,
    HealthModule,
    AccountsModule,
    AssetsModule,
    CategoriesModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class AppModule {}
