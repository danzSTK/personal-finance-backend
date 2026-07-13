import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IEmailMessageRepository } from './domain/repositories/email-message.repository.interface';
import { EmailMessageOrmEntity } from './infrastructure/persistence/email-message-orm.entity';
import { EmailMessageRepository } from './infrastructure/persistence/email-message.repository';

@Module({
  imports: [TypeOrmModule.forFeature([EmailMessageOrmEntity])],
  providers: [{ provide: IEmailMessageRepository, useClass: EmailMessageRepository }],
  exports: [IEmailMessageRepository],
})
export class NotificationsPersistenceModule {}
