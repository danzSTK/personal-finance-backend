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
import { AuthProviderModule } from '@/modules/auth-provider/auth-provider.module';
import { CommonModule } from '@/common/common.module';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisOptions } from '@/config/redis/redis-options';
import { RedisModule } from '@/database/redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
        type: 'postgres',
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.dbName,
        entities: ENTITIES,
        synchronize: false,
        logging: true,
      }),
      inject: [databaseConfig.KEY],
    }),
    CacheModule.registerAsync(RedisOptions),
    RedisModule,
    UsersModule,
    AuthModule,
    AuthProviderModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
