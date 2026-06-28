import { MailProviderName } from '@/shared/mail/constants/mail.constants';
import { MailProvider } from '@/shared/mail/interfaces/mail-provider.interface';
import { SendMailInput, SendMailResult } from '@/shared/mail/interfaces/mail-message.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NoopMailProvider extends MailProvider {
  send(input: SendMailInput): Promise<SendMailResult> {
    return Promise.resolve({
      provider: MailProviderName.NOOP,
      messageId: 'noop',
      accepted: input.to.length,
    });
  }
}
