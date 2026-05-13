import { Module } from '@nestjs/common';
import { AppController } from '@/app/app.controller';
import { AppService } from '@/app/app.service';
import { ConfigModule } from '@/config/config.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigType } from '@nestjs/config';
import { ENTITIES } from '@/config/entities';
import { UsersModule } from '@/modules/users/users.module';
import databaseConfig from '../config/database.config';
import { AuthModule } from '@/modules/auth/auth.module';
import { CommonModule } from '@/common/common.module';
import { RedisModule } from '@/database/redis/redis.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import throttleConfig from '@/config/throttle.config';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import { RedisService } from '../database/redis/redis.service';
import { SessionModule } from '../shared/session-tracking/session-metadata.module';
import { HealthModule } from '../modules/health/health.module';
import appConfig from '../config/app.config';
import { AppStatus } from '../common/models/enums';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { OriginGuard } from '../shared/guards/origin.guard';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { AppEventsModule } from '@/shared/events';
import { OutboxModule } from '@/shared/outbox';

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
    AppEventsModule,
    OutboxModule,
    UsersModule,
    AuthModule,
    CommonModule,
    SessionModule,
    HealthModule,
    AccountsModule,
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
  ],
})
export class AppModule {}
