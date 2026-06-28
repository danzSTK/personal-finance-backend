import queueConfig from '@/config/queue.config';
import { ConfigModule } from '@/config/config.module';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [queueConfig.KEY],
      useFactory: (config: ConfigType<typeof queueConfig>) => ({
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db,
        },
        prefix: config.prefix,
        defaultJobOptions: {
          attempts: config.defaultJobOptions.attempts,
          backoff: {
            type: config.defaultJobOptions.backoffType,
            delay: config.defaultJobOptions.backoffDelayMs,
          },
          removeOnComplete: config.defaultJobOptions.removeOnComplete,
          removeOnFail: config.defaultJobOptions.removeOnFail,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
