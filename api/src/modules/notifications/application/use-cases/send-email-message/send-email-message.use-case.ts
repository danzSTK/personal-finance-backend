import { MailError, MailErrorCode } from '@/shared/mail/errors/mail-error';
import { MailService } from '@/shared/mail/mail.service';
import {
  SendEmailMessageUseCaseInput,
  SendEmailMessageUseCaseOutput,
} from '@/modules/notifications/application/use-cases/send-email-message/send-email-message.dto';
import { EmailMessageNotFoundError } from '@/modules/notifications/application/errors';
import { EmailMessageStatus } from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

interface MailFailure {
  code: string;
  message: string;
  retryable: boolean;
  cause: Error;
}

@Injectable()
export class SendEmailMessageUseCase {
  constructor(
    private readonly emailMessageRepository: IEmailMessageRepository,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
  ) {}

  async execute(input: SendEmailMessageUseCaseInput): Promise<SendEmailMessageUseCaseOutput> {
    const emailMessage = await this.prepareMessage(input.emailMessageId);

    if (!emailMessage.canBeProcessed) {
      return {
        status: emailMessage.status,
        sent: emailMessage.status === EmailMessageStatus.SENT,
      };
    }

    try {
      const result = await this.mailService.send({
        to: [
          {
            email: emailMessage.recipientEmail,
            name: emailMessage.recipientName ?? undefined,
          },
        ],
        templateId: Number(emailMessage.providerTemplateId),
        params: emailMessage.templateParams,
        tags: [emailMessage.templateKey, emailMessage.type],
        metadata: {
          emailMessageId: emailMessage.id,
          idempotencyKey: emailMessage.idempotencyKey,
        },
      });

      const providerMessageId = result.messageId ?? result.messageIds?.[0] ?? null;
      const sentMessage = await this.markSent(input.emailMessageId, providerMessageId);

      return {
        status: sentMessage.status,
        sent: true,
      };
    } catch (error) {
      const failure = this.toFailure(error);
      const failedMessage = await this.markFailed(input.emailMessageId, failure);

      if (failure.retryable) {
        throw failure.cause;
      }

      return {
        status: failedMessage.status,
        sent: false,
      };
    }
  }

  private async prepareMessage(emailMessageId: string): Promise<EmailMessage> {
    return await this.dataSource.transaction(async manager => {
      const emailMessage = await this.findMessageForUpdate(emailMessageId, manager);

      if (!emailMessage.canBeProcessed) {
        return emailMessage;
      }

      emailMessage.markProcessing();

      return await this.emailMessageRepository.save(emailMessage, { manager });
    });
  }

  private async markSent(emailMessageId: string, providerMessageId: string | null): Promise<EmailMessage> {
    return await this.dataSource.transaction(async manager => {
      const emailMessage = await this.findMessageForUpdate(emailMessageId, manager);
      emailMessage.markSent(providerMessageId);

      return await this.emailMessageRepository.save(emailMessage, { manager });
    });
  }

  private async markFailed(emailMessageId: string, failure: MailFailure): Promise<EmailMessage> {
    return await this.dataSource.transaction(async manager => {
      const emailMessage = await this.findMessageForUpdate(emailMessageId, manager);
      emailMessage.markFailed(failure.code, failure.message, failure.retryable);

      return await this.emailMessageRepository.save(emailMessage, { manager });
    });
  }

  private async findMessageForUpdate(emailMessageId: string, manager: EntityManager): Promise<EmailMessage> {
    const emailMessage = await this.emailMessageRepository.findByIdForUpdate(emailMessageId, { manager });

    if (!emailMessage) {
      throw new EmailMessageNotFoundError();
    }

    return emailMessage;
  }

  private toFailure(error: unknown): MailFailure {
    if (error instanceof MailError) {
      return {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        cause: error,
      };
    }

    if (error instanceof Error) {
      return {
        code: MailErrorCode.PROVIDER_UNKNOWN,
        message: error.message,
        retryable: true,
        cause: error,
      };
    }

    return {
      code: MailErrorCode.PROVIDER_UNKNOWN,
      message: 'Mail provider failed unexpectedly.',
      retryable: true,
      cause: MailError.providerUnknown(),
    };
  }
}
