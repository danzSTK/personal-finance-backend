import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { AppStatus } from '../common/models/enums';
import { ENTITIES } from '../config/entities';
import { parsePostgresSslFlag, resolvePostgresSsl } from './postgres/postgres-ssl';

// Carrega o .env da raiz
if (process.env.NODE_ENV !== AppStatus.PRODUCTION) {
  config({ path: join(process.cwd(), '..', '.env') });
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: ENTITIES,
  migrations: [join(__dirname, './migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === AppStatus.PRODUCTION ? ['error'] : true,
  ssl: resolvePostgresSsl({
    isProduction: process.env.NODE_ENV === AppStatus.PRODUCTION,
    enabled: parsePostgresSslFlag(process.env.POSTGRES_SSL),
  }),
});
