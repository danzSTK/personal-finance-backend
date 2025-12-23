export interface AppConfig {
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    dbName: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT!, 10) || 3000,
  database: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT!, 10) || 5432,
    username: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    dbName: process.env.POSTGRES_DB!,
  },
});
