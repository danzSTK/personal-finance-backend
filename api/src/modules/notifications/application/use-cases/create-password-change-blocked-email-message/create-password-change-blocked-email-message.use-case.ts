import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import notificationsConfig from '@/config/notifications.config';
import { PasswordChangeNotificationUserNotFoundError } from '@/modules/notifications/application/errors';
import { formatBrasiliaDateTime } from '@/modules/notifications/application/templates/brasilia-date-time.formatter';
import { EmailTemplateContractRegistry } from '@/modules/notifications/application/templates/email-template-contract.registry';
import {
  CreatePasswordChangeBlockedEmailMessageUseCaseInput,
  CreatePasswordChangeBlockedEmailMessageUseCaseOutput,
} from '@/modules/notifications/application/use-cases/create-password-change-blocked-email-message/create-password-change-blocked-email-message.dto';
import {
  EmailMessageType,
  PasswordChangeBlockedEmailIdempotencyKeys,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import {
  ActiveEmailTemplateVersion,
  EmailTemplateKey,
  PasswordChangeBlockedV1Params,
} from '@/modules/notifications/domain/templates/email-template.contract';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

const EMAIL_MESSAGES_IDEMPOTENCY_CONSTRAINT = 'UQ_email_messages_idempotency_key';

@Injectable()
export class CreatePasswordChangeBlockedEmailMessageUseCase {
  constructor(
    private readonly emailMessageRepository: IEmailMessageRepository,
    private readonly userRepository: IUserRepository,
    @Inject(notificationsConfig.KEY)
    private readonly notifications: ConfigType<typeof notificationsConfig>,
  ) {}

  async execute(
    input: CreatePasswordChangeBlockedEmailMessageUseCaseInput,
  ): Promise<CreatePasswordChangeBlockedEmailMessageUseCaseOutput> {
    const idempotencyKey = PasswordChangeBlockedEmailIdempotencyKeys.event(input.sourceEventId);
    const existingMessage = await this.emailMessageRepository.findByIdempotencyKey(idempotencyKey);

    if (existingMessage) {
      return {
        emailMessage: existingMessage,
        created: false,
        shouldEnqueue: existingMessage.canBeEnqueued,
      };
    }

    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new PasswordChangeNotificationUserNotFoundError();
    }

    const recipientEmail = user.email.value;
    const recipientName = user.firstName ?? null;
    const templateKey = EmailTemplateKey.PASSWORD_CHANGE_BLOCKED;
    const templateVersion = ActiveEmailTemplateVersion[templateKey];
    const templateParams = EmailTemplateContractRegistry.validate(
      templateKey,
      templateVersion,
      this.buildTemplateParams(recipientName, recipientEmail, input.blockedUntil, input.securityContext),
    );

    const emailMessage = EmailMessage.create(
      {
        type: EmailMessageType.PASSWORD_CHANGE_BLOCKED,
        recipientEmail,
        recipientName,
        provider: null,
        templateKey,
        templateVersion,
        templateParams,
        idempotencyKey,
        providerMessageId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        processingAt: null,
        sentAt: null,
        failedAt: null,
        deliverBefore: null,
      },
      randomUUID(),
    );

    try {
      const savedMessage = await this.emailMessageRepository.save(emailMessage);

      return {
        emailMessage: savedMessage,
        created: true,
        shouldEnqueue: true,
      };
    } catch (error) {
      if (!this.isIdempotencyConflict(error)) {
        throw error;
      }

      const concurrentMessage = await this.emailMessageRepository.findByIdempotencyKey(idempotencyKey);

      if (!concurrentMessage) {
        throw error;
      }

      return {
        emailMessage: concurrentMessage,
        created: false,
        shouldEnqueue: concurrentMessage.canBeEnqueued,
      };
    }
  }

  private buildTemplateParams(
    firstName: string | null,
    email: string,
    blockedUntil: Date,
    securityContext: CreatePasswordChangeBlockedEmailMessageUseCaseInput['securityContext'],
  ): PasswordChangeBlockedV1Params {
    return {
      first_name: this.resolveFirstName(firstName, email),
      blocked_until: formatBrasiliaDateTime(blockedUntil),
      ip_address: this.resolveContextValue(securityContext.ipAddress),
      location: this.resolveContextValue(securityContext.location),
      browser: this.resolveContextValue(securityContext.browser),
      operating_system: this.resolveContextValue(securityContext.operatingSystem),
      device: this.resolveContextValue(securityContext.device),
      support_url: this.notifications.supportUrl,
    };
  }

  private resolveFirstName(firstName: string | null, email: string): string {
    const normalizedFirstName = firstName?.trim();

    if (normalizedFirstName) {
      return normalizedFirstName;
    }

    const localPart = email.split('@')[0]?.trim();

    return localPart || 'cliente';
  }

  private resolveContextValue(value: string | null): string {
    const normalizedValue = value?.trim();

    return normalizedValue || 'Não identificado';
  }

  private isIdempotencyConflict(error: unknown): boolean {
    return (
      isPostgresUniqueViolation(error) && getPostgresConstraintName(error) === EMAIL_MESSAGES_IDEMPOTENCY_CONSTRAINT
    );
  }
}
