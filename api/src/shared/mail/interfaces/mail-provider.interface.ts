import { SendMailInput, SendMailResult } from './mail-message.interface';

export abstract class MailProvider {
  abstract send(input: SendMailInput): Promise<SendMailResult>;
}
