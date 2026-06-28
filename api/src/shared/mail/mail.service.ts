import mailConfig from '@/config/mail.config';
import { MailError } from '@/shared/mail/errors/mail-error';
import { MailProvider } from '@/shared/mail/interfaces/mail-provider.interface';
import { MailAddress, SendMailInput, SendMailResult } from '@/shared/mail/interfaces/mail-message.interface';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private readonly mailProvider: MailProvider,
    @Inject(mailConfig.KEY)
    private readonly config: ConfigType<typeof mailConfig>,
  ) {}

  async send(input: SendMailInput): Promise<SendMailResult> {
    const normalizedInput = this.normalizeInput(input);

    return await this.mailProvider.send(normalizedInput);
  }

  private normalizeInput(input: SendMailInput): SendMailInput {
    this.validateRecipients(input.to);

    const from = input.from ?? this.getDefaultSender();

    if (!from) {
      throw MailError.invalidPayload('Mail sender is required.');
    }

    if (!input.templateId && !this.hasText(input.subject)) {
      throw MailError.invalidPayload('Mail subject is required when no template is provided.');
    }

    if (!input.templateId && !this.hasText(input.html) && !this.hasText(input.text)) {
      throw MailError.invalidPayload('Mail content is required when no template is provided.');
    }

    return {
      ...input,
      from,
    };
  }

  private validateRecipients(recipients: MailAddress[]): void {
    if (recipients.length === 0) {
      throw MailError.invalidPayload('At least one mail recipient is required.');
    }

    if (recipients.some(recipient => !this.hasText(recipient.email))) {
      throw MailError.invalidPayload('Every mail recipient must include an email address.');
    }
  }

  private getDefaultSender(): MailAddress | null {
    if (!this.config.defaultSender.email) {
      return null;
    }

    return {
      email: this.config.defaultSender.email,
      name: this.config.defaultSender.name,
    };
  }

  private hasText(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }
}
