import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import appConfig from '@/config/app.config';
import notificationsConfig from '@/config/notifications.config';
import { EmailVerificationUserNotFoundError } from '@/modules/notifications/application/errors';
import {
  CreateEmailVerificationMessageUseCaseInput,
  CreateEmailVerificationMessageUseCaseOutput,
} from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.dto';
import {
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
  EmailVerificationIdempotencyKeys,
  EmailVerificationParams,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

const EMAIL_MESSAGES_IDEMPOTENCY_CONSTRAINT = 'UQ_email_messages_idempotency_key';

@Injectable()
export class CreateEmailVerificationMessageUseCase {
  constructor(
    private readonly emailMessageRepository: IEmailMessageRepository,
    private readonly userRepository: IUserRepository,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
    @Inject(notificationsConfig.KEY)
    private readonly notifications: ConfigType<typeof notificationsConfig>,
  ) {}

  async execute(
    input: CreateEmailVerificationMessageUseCaseInput,
  ): Promise<CreateEmailVerificationMessageUseCaseOutput> {
    const idempotencyKey = EmailVerificationIdempotencyKeys.challenge(input.challengeId);
    const existingMessage = await this.emailMessageRepository.findByIdempotencyKey(idempotencyKey, input.options);

    if (existingMessage) {
      return {
        emailMessage: existingMessage,
        created: false,
        shouldEnqueue: existingMessage.canBeEnqueued,
      };
    }

    if (!input.token) {
      return {
        emailMessage: null,
        created: false,
        shouldEnqueue: false,
      };
    }

    const user = await this.userRepository.findById(input.userId, input.options);

    if (!user) {
      throw new EmailVerificationUserNotFoundError();
    }

    const recipientEmail = user.email.value;
    const recipientName = user.firstName ?? null;
    const params = this.buildTemplateParams(recipientName, recipientEmail, input.token);

    const emailMessage = EmailMessage.create(
      {
        type: EmailMessageType.EMAIL_VERIFICATION,
        recipientEmail,
        recipientName,
        provider: EmailProviderKey.BREVO,
        templateKey: EmailTemplateKey.EMAIL_VERIFICATION,
        providerTemplateId: this.notifications.emailVerificationProviderTemplateId,
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
      const savedMessage = await this.emailMessageRepository.save(emailMessage, input.options);

      return {
        emailMessage: savedMessage,
        created: true,
        shouldEnqueue: true,
      };
    } catch (error) {
      if (!this.isIdempotencyConflict(error)) {
        throw error;
      }

      const concurrentMessage = await this.emailMessageRepository.findByIdempotencyKey(idempotencyKey, input.options);

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

  private buildTemplateParams(firstName: string | null, email: string, token: string): EmailVerificationParams {
    return {
      first_name: this.resolveFirstName(firstName, email),
      verification_url: this.buildVerificationUrl(token),
      expires_in_minutes: this.notifications.emailVerificationTokenTtlMinutes,
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

  private buildVerificationUrl(token: string): string {
    const baseUrl = this.app.frontendUrl.replace(/\/+$/, '');
    const path = this.notifications.emailVerificationPath.startsWith('/')
      ? this.notifications.emailVerificationPath
      : `/${this.notifications.emailVerificationPath}`;
    const url = new URL(`${baseUrl}${path}`);

    url.searchParams.set('token', token);

    return url.toString();
  }

  private isIdempotencyConflict(error: unknown): boolean {
    return (
      isPostgresUniqueViolation(error) && getPostgresConstraintName(error) === EMAIL_MESSAGES_IDEMPOTENCY_CONSTRAINT
    );
  }
}
