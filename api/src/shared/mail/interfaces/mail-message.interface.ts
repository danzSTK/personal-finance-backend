export interface MailAddress {
  email: string;
  name?: string;
}

export interface SendMailInput {
  to: MailAddress[];
  subject?: string;
  from?: MailAddress;
  replyTo?: MailAddress;
  html?: string;
  text?: string;
  templateId?: number;
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
