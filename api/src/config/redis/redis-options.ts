import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import redisConfig from './redis.config';
import { ConfigModule } from '../config.module';
import { type ConfigType } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

export const RedisOptions: CacheModuleAsyncOptions = {
  isGlobal: true,
  imports: [ConfigModule],
  useFactory: async (rdConfig: ConfigType<typeof redisConfig>) => {
    const store = await redisStore({
      socket: {
        host: rdConfig.host,
        port: rdConfig.port,
      },
      password: rdConfig.password,
      ttl: rdConfig.ttl * 1000,
    });
    return {
      store: () => store,
    };
  },
  inject: [redisConfig.KEY],
};
