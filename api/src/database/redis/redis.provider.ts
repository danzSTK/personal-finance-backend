import { Provider } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import redisConfig from '@/config/redis.config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (rdConfig: ConfigType<typeof redisConfig>) => {
    return new Redis({
      host: rdConfig.host,
      port: rdConfig.port,
      password: rdConfig.password,
    });
  },
  inject: [redisConfig.KEY],
};
