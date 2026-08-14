import { MailProviderName } from '@/shared/mail/constants/mail.constants';
import { MailError } from '@/shared/mail/errors/mail-error';
import { MailErrorMapper } from '@/shared/mail/errors/mail-error.mapper';
import { MailProvider } from '@/shared/mail/interfaces/mail-provider.interface';
import { SendMailInput, SendMailResult } from '@/shared/mail/interfaces/mail-message.interface';
import { BREVO_CLIENT, BrevoClientPort } from '@/shared/mail/providers/brevo-client.provider';
import { Brevo } from '@getbrevo/brevo';
import { Inject, Injectable } from '@nestjs/common';
import mailConfig from '@/config/mail.config';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class BrevoMailProvider extends MailProvider {
  constructor(
    @Inject(BREVO_CLIENT)
    private readonly brevoClient: BrevoClientPort | null,
    @Inject(mailConfig.KEY)
    private readonly config: ConfigType<typeof mailConfig>,
  ) {
    super();
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!this.brevoClient) {
      throw MailErrorMapper.fromProviderError(new Error('Brevo client is not configured.'));
    }

    try {
      const response = await this.brevoClient.transactionalEmails.sendTransacEmail(this.toBrevoPayload(input));

      return {
        provider: MailProviderName.BREVO,
        messageId: response.messageId,
        messageIds: response.messageIds,
        accepted: input.to.length,
      };
    } catch (error) {
      throw MailErrorMapper.fromProviderError(error);
    }
  }

  private toBrevoPayload(input: SendMailInput): Brevo.SendTransacEmailRequest {
    const templateId = input.template ? this.resolveTemplateId(input.template.key, input.template.version) : undefined;

    return {
      to: input.to.map(address => ({ email: address.email, name: address.name })),
      sender: input.from ? { email: input.from.email, name: input.from.name } : undefined,
      replyTo: input.replyTo ? { email: input.replyTo.email, name: input.replyTo.name } : undefined,
      subject: input.subject,
      htmlContent: input.template ? undefined : input.html,
      textContent: input.template ? undefined : input.text,
      templateId,
      params: input.params,
      tags: input.tags,
      headers: input.metadata,
    };
  }

  private resolveTemplateId(templateKey: string, templateVersion: number): number {
    const mappingKey = `${templateKey}:v${templateVersion}`;
    const templateId = this.config.brevo.templateIds[mappingKey];

    if (!Number.isSafeInteger(templateId) || (templateId ?? 0) < 1) {
      throw MailErrorMapper.fromProviderError(MailError.templateMappingMissing(templateKey, templateVersion));
    }

    return templateId as number;
  }
}
