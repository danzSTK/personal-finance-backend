import { AppStatus } from '@/common/models/enums';
import appConfig from '@/config/app.config';
import databaseConfig from '@/config/database.config';
import { ENTITIES } from '@/config/entities';
import type { ConfigType } from '@nestjs/config';
import { createPostgresOptions } from './postgres.module';

describe('createPostgresOptions', () => {
  const database = {
    host: 'postgres.internal',
    port: 5432,
    username: 'danfy',
    password: 'secret',
    dbName: 'danfy_test',
  } as ConfigType<typeof databaseConfig>;

  it('wires the shared entities without schema synchronization', () => {
    const options = createPostgresOptions(database, {
      nodeEnv: AppStatus.TEST,
    } as ConfigType<typeof appConfig>);

    expect(options).toEqual(
      expect.objectContaining({
        type: 'postgres',
        host: 'postgres.internal',
        database: 'danfy_test',
        entities: ENTITIES,
        synchronize: false,
        logging: true,
        ssl: false,
      }),
    );
  });

  it('limits production SQL logs to errors and enables PostgreSQL SSL', () => {
    const options = createPostgresOptions(database, {
      nodeEnv: AppStatus.PRODUCTION,
    } as ConfigType<typeof appConfig>);

    expect(options.logging).toEqual(['error']);
    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });
});
