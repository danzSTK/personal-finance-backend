import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT!, 10) || 5432,
  username: process.env.POSTGRES_USER!,
  password: process.env.POSTGRES_PASSWORD!,
  dbName: process.env.POSTGRES_DB!,
}));
