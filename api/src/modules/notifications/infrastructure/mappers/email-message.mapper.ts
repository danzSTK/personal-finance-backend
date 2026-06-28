import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { EmailMessageOrmEntity } from '@/modules/notifications/infrastructure/persistence/email-message-orm.entity';

export class EmailMessageMapper {
  static toDomain(entity: EmailMessageOrmEntity): EmailMessage {
    return EmailMessage.reconstitute(
      {
        type: entity.type,
        recipientEmail: entity.recipient_email,
        recipientName: entity.recipient_name,
        provider: entity.provider,
        templateKey: entity.template_key,
        providerTemplateId: entity.provider_template_id,
        templateParams: entity.template_params,
        idempotencyKey: entity.idempotency_key,
        status: entity.status,
        providerMessageId: entity.provider_message_id,
        attemptsCount: entity.attempts_count,
        lastErrorCode: entity.last_error_code,
        lastErrorMessage: entity.last_error_message,
        processingAt: entity.processing_at,
        sentAt: entity.sent_at,
        failedAt: entity.failed_at,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      },
      entity.id,
    );
  }

  static toOrm(emailMessage: EmailMessage): Partial<EmailMessageOrmEntity> {
    return {
      id: emailMessage.id,
      type: emailMessage.type,
      recipient_email: emailMessage.recipientEmail,
      recipient_name: emailMessage.recipientName,
      provider: emailMessage.provider,
      template_key: emailMessage.templateKey,
      provider_template_id: emailMessage.providerTemplateId,
      template_params: { ...emailMessage.templateParams },
      idempotency_key: emailMessage.idempotencyKey,
      status: emailMessage.status,
      provider_message_id: emailMessage.providerMessageId,
      attempts_count: emailMessage.attemptsCount,
      last_error_code: emailMessage.lastErrorCode,
      last_error_message: emailMessage.lastErrorMessage,
      processing_at: emailMessage.processingAt,
      sent_at: emailMessage.sentAt,
      failed_at: emailMessage.failedAt,
      created_at: emailMessage.createdAt,
      updated_at: emailMessage.updatedAt,
    };
  }
}
