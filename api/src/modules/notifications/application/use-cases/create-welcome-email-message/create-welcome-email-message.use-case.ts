import appConfig from '@/config/app.config';
import notificationsConfig from '@/config/notifications.config';
import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import {
  BrevoTemplateId,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
  WelcomeEmailIdempotencyKeys,
  WelcomeEmailParams,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import {
  CreateWelcomeEmailMessageUseCaseInput,
  CreateWelcomeEmailMessageUseCaseOutput,
} from '@/modules/notifications/application/use-cases/create-welcome-email-message/create-welcome-email-message.dto';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

const EMAIL_MESSAGES_IDEMPOTENCY_CONSTRAINT = 'UQ_email_messages_idempotency_key';

@Injectable()
export class CreateWelcomeEmailMessageUseCase {
  constructor(
    private readonly emailMessageRepository: IEmailMessageRepository,
    private readonly userRepository: IUserRepository,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
    @Inject(notificationsConfig.KEY)
    private readonly notifications: ConfigType<typeof notificationsConfig>,
  ) {}

  async execute(input: CreateWelcomeEmailMessageUseCaseInput): Promise<CreateWelcomeEmailMessageUseCaseOutput> {
    const idempotencyKey = WelcomeEmailIdempotencyKeys.user(input.userId);
    const existingMessage = await this.emailMessageRepository.findByIdempotencyKey(idempotencyKey);

    if (existingMessage) {
      return {
        emailMessage: existingMessage,
        created: false,
        shouldEnqueue: existingMessage.canBeEnqueued,
      };
    }

    const user = await this.userRepository.findById(input.userId);
    const recipientEmail = user?.email.value ?? input.email;
    const recipientName = user?.firstName ?? null;
    const params = this.buildTemplateParams(recipientName, recipientEmail);

    const emailMessage = EmailMessage.create(
      {
        type: EmailMessageType.WELCOME,
        recipientEmail,
        recipientName,
        provider: EmailProviderKey.BREVO,
        templateKey: EmailTemplateKey.WELCOME,
        providerTemplateId: BrevoTemplateId.WELCOME,
        templateParams: params,
        idempotencyKey,
        providerMessageId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        processingAt: null,
        sentAt: null,
        failedAt: null,
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

  private buildTemplateParams(firstName: string | null, email: string): WelcomeEmailParams {
    return {
      first_name: this.resolveFirstName(firstName, email),
      dashboard_url: this.buildFrontendUrl(this.notifications.dashboardPath),
      support_url: this.notifications.supportUrl,
      support_url_label: this.notifications.supportUrlLabel,
      preferences_url: this.buildFrontendUrl(this.notifications.emailPreferencesPath),
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

  private buildFrontendUrl(path: string): string {
    const baseUrl = this.app.frontendUrl.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${baseUrl}${normalizedPath}`;
  }

  private isIdempotencyConflict(error: unknown): boolean {
    return (
      isPostgresUniqueViolation(error) && getPostgresConstraintName(error) === EMAIL_MESSAGES_IDEMPOTENCY_CONSTRAINT
    );
  }
}
