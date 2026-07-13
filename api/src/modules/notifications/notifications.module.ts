import { Module } from '@nestjs/common';
import { NotificationsProducerModule } from './notifications-producer.module';

@Module({
  imports: [NotificationsProducerModule],
  exports: [NotificationsProducerModule],
})
export class NotificationsModule {}
