import appConfig from '@/config/app.config';
import { ConfigModule } from '@/config/config.module';
import databaseConfig from '@/config/database.config';
import { ENTITIES } from '@/config/entities';
import { AppStatus } from '@/common/models/enums';
import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
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
  ],
  exports: [TypeOrmModule],
})
export class PostgresModule {}
