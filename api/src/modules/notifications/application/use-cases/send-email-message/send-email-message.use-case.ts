import { MailError, MailErrorCode } from '@/shared/mail/errors/mail-error';
import { MailService } from '@/shared/mail/mail.service';
import {
  SendEmailMessageUseCaseInput,
  SendEmailMessageUseCaseOutput,
} from '@/modules/notifications/application/use-cases/send-email-message/send-email-message.dto';
import { EmailMessageNotFoundError } from '@/modules/notifications/application/errors';
import {
  EmailMessageFailureCode,
  EmailMessageStatus,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EmailTemplateContractRegistry } from '@/modules/notifications/application/templates/email-template-contract.registry';
import { EmailTemplateContractError } from '@/modules/notifications/application/errors/email-template-contract.error';

interface MailFailure {
  code: string;
  message: string;
  retryable: boolean;
  cause: Error;
}

interface PreparedEmailMessage {
  emailMessage: EmailMessage;
  deliveryDeadlineExceeded: boolean;
}

@Injectable()
export class SendEmailMessageUseCase {
  constructor(
    private readonly emailMessageRepository: IEmailMessageRepository,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
  ) {}

  async execute(input: SendEmailMessageUseCaseInput): Promise<SendEmailMessageUseCaseOutput> {
    const prepared = await this.prepareMessage(input.emailMessageId, input.now);
    let emailMessage = prepared.emailMessage;

    if (prepared.deliveryDeadlineExceeded) {
      return {
        status: emailMessage.status,
        sent: false,
        unrecoverable: true,
      };
    }

    if (!emailMessage.canBeProcessed) {
      return {
        status: emailMessage.status,
        sent: emailMessage.status === EmailMessageStatus.SENT,
        unrecoverable: false,
      };
    }

    let templateParams: Record<string, unknown>;

    try {
      templateParams = EmailTemplateContractRegistry.parse(
        emailMessage.templateKey,
        emailMessage.templateVersion,
        emailMessage.templateParams,
      );
    } catch (error) {
      return await this.handleFailure(input.emailMessageId, error);
    }

    if (emailMessage.deliverBefore !== null) {
      const revalidated = await this.revalidateDeliveryDeadline(input.emailMessageId, input.now);
      emailMessage = revalidated.emailMessage;

      if (revalidated.deliveryDeadlineExceeded) {
        return {
          status: emailMessage.status,
          sent: false,
          unrecoverable: true,
        };
      }

      if (!emailMessage.canBeProcessed) {
        return {
          status: emailMessage.status,
          sent: emailMessage.status === EmailMessageStatus.SENT,
          unrecoverable: false,
        };
      }

      const dispatchNow = this.currentTime(input.now);

      if (emailMessage.hasReachedDeliveryDeadline(dispatchNow)) {
        const expiredBeforeDispatch = await this.revalidateDeliveryDeadline(input.emailMessageId, dispatchNow);
        emailMessage = expiredBeforeDispatch.emailMessage;

        if (expiredBeforeDispatch.deliveryDeadlineExceeded) {
          return {
            status: emailMessage.status,
            sent: false,
            unrecoverable: true,
          };
        }

        if (!emailMessage.canBeProcessed) {
          return {
            status: emailMessage.status,
            sent: emailMessage.status === EmailMessageStatus.SENT,
            unrecoverable: false,
          };
        }
      }
    }

    try {
      const result = await this.mailService.send({
        to: [
          {
            email: emailMessage.recipientEmail,
            name: emailMessage.recipientName ?? undefined,
          },
        ],
        template: {
          key: emailMessage.templateKey,
          version: emailMessage.templateVersion,
        },
        params: templateParams,
        tags: [emailMessage.templateKey, emailMessage.type, `v${emailMessage.templateVersion}`],
        metadata: {
          'X-Danfy-Email-Message-Id': emailMessage.id,
        },
      });

      const providerMessageId = result.messageId ?? result.messageIds?.[0] ?? null;
      const sentMessage = await this.markSent(input.emailMessageId, result.provider, providerMessageId);

      return {
        status: sentMessage.status,
        sent: true,
        unrecoverable: false,
      };
    } catch (error) {
      return await this.handleFailure(input.emailMessageId, error);
    }
  }

  private async prepareMessage(emailMessageId: string, fixedNow?: Date): Promise<PreparedEmailMessage> {
    return await this.dataSource.transaction(async manager => {
      const emailMessage = await this.findMessageForUpdate(emailMessageId, manager);

      if (!emailMessage.canBeProcessed) {
        return { emailMessage, deliveryDeadlineExceeded: false };
      }

      const now = this.currentTime(fixedNow);

      if (emailMessage.hasReachedDeliveryDeadline(now)) {
        this.cancelForDeliveryDeadline(emailMessage, now);

        return {
          emailMessage: await this.emailMessageRepository.save(emailMessage, { manager }),
          deliveryDeadlineExceeded: true,
        };
      }

      emailMessage.markProcessing(now);

      return {
        emailMessage: await this.emailMessageRepository.save(emailMessage, { manager }),
        deliveryDeadlineExceeded: false,
      };
    });
  }

  private async revalidateDeliveryDeadline(emailMessageId: string, fixedNow?: Date): Promise<PreparedEmailMessage> {
    return await this.dataSource.transaction(async manager => {
      const emailMessage = await this.findMessageForUpdate(emailMessageId, manager);

      if (!emailMessage.canBeProcessed || emailMessage.deliverBefore === null) {
        return { emailMessage, deliveryDeadlineExceeded: false };
      }

      const now = this.currentTime(fixedNow);

      if (!emailMessage.hasReachedDeliveryDeadline(now)) {
        return { emailMessage, deliveryDeadlineExceeded: false };
      }

      this.cancelForDeliveryDeadline(emailMessage, now);

      return {
        emailMessage: await this.emailMessageRepository.save(emailMessage, { manager }),
        deliveryDeadlineExceeded: true,
      };
    });
  }

  private cancelForDeliveryDeadline(emailMessage: EmailMessage, now: Date): void {
    emailMessage.cancel(
      EmailMessageFailureCode.DELIVERY_DEADLINE_EXCEEDED,
      'Email delivery deadline was reached before provider dispatch.',
      now,
    );
  }

  private currentTime(fixedNow?: Date): Date {
    return fixedNow ?? new Date(Date.now());
  }

  private async markSent(
    emailMessageId: string,
    provider: string,
    providerMessageId: string | null,
  ): Promise<EmailMessage> {
    return await this.dataSource.transaction(async manager => {
      const emailMessage = await this.findMessageForUpdate(emailMessageId, manager);
      emailMessage.markSent(provider, providerMessageId);

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

  private async handleFailure(emailMessageId: string, error: unknown): Promise<SendEmailMessageUseCaseOutput> {
    const failure = this.toFailure(error);
    const failedMessage = await this.markFailed(emailMessageId, failure);

    if (failure.retryable) {
      throw failure.cause;
    }

    return {
      status: failedMessage.status,
      sent: false,
      unrecoverable: false,
    };
  }

  private async findMessageForUpdate(emailMessageId: string, manager: EntityManager): Promise<EmailMessage> {
    const emailMessage = await this.emailMessageRepository.findByIdForUpdate(emailMessageId, { manager });

    if (!emailMessage) {
      throw new EmailMessageNotFoundError();
    }

    return emailMessage;
  }

  private toFailure(error: unknown): MailFailure {
    if (error instanceof EmailTemplateContractError) {
      return {
        code: error.code,
        message: error.message,
        retryable: false,
        cause: error,
      };
    }

    if (error instanceof MailError) {
      return {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        cause: error,
      };
    }

    const safeError = MailError.providerUnknown();

    return {
      code: MailErrorCode.PROVIDER_UNKNOWN,
      message: safeError.message,
      retryable: true,
      cause: safeError,
    };
  }
}
