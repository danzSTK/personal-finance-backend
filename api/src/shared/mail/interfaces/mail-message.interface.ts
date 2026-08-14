export interface MailAddress {
  email: string;
  name?: string;
}

export interface MailTemplateReference {
  key: string;
  version: number;
}

export interface SendMailInput {
  to: MailAddress[];
  subject?: string;
  from?: MailAddress;
  replyTo?: MailAddress;
  html?: string;
  text?: string;
  template?: MailTemplateReference;
  params?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface SendMailResult {
  provider: string;
  messageId?: string;
  messageIds?: string[];
  accepted: number;
}
