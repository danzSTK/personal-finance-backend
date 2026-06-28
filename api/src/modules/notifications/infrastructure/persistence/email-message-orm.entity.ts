import {
  EmailMessageLimits,
  EmailMessageStatus,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('email_messages')
@Index('UQ_email_messages_idempotency_key', ['idempotency_key'], { unique: true })
@Index('idx_email_messages_status_created_at', ['status', 'created_at'])
@Index('idx_email_messages_recipient_email_created_at', ['recipient_email', 'created_at'])
@Index('idx_email_messages_type_created_at', ['type', 'created_at'])
@Check(
  'CHK_email_messages_status',
  `"status" IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'CANCELED')`,
)
@Check('CHK_email_messages_attempts_count', `"attempts_count" >= 0`)
@Check('CHK_email_messages_template_params_object', `jsonb_typeof("template_params") = 'object'`)
export class EmailMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: EmailMessageType;

  @Column({ type: 'varchar', length: EmailMessageLimits.recipientEmailMaxLength })
  recipient_email: string;

  @Column({ type: 'varchar', length: EmailMessageLimits.recipientNameMaxLength, nullable: true })
  recipient_name: string | null;

  @Column({ type: 'varchar', length: EmailMessageLimits.providerMaxLength })
  provider: EmailProviderKey;

  @Column({ type: 'varchar', length: EmailMessageLimits.templateKeyMaxLength })
  template_key: EmailTemplateKey;

  @Column({ type: 'varchar', length: EmailMessageLimits.providerTemplateIdMaxLength })
  provider_template_id: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  template_params: Record<string, unknown>;

  @Column({ type: 'varchar', length: EmailMessageLimits.idempotencyKeyMaxLength })
  idempotency_key: string;

  @Column({ type: 'varchar', length: EmailMessageLimits.statusMaxLength, default: EmailMessageStatus.PENDING })
  status: EmailMessageStatus;

  @Column({ type: 'varchar', length: EmailMessageLimits.providerMessageIdMaxLength, nullable: true })
  provider_message_id: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts_count: number;

  @Column({ type: 'varchar', length: EmailMessageLimits.lastErrorCodeMaxLength, nullable: true })
  last_error_code: string | null;

  @Column({ type: 'text', nullable: true })
  last_error_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processing_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
