export const NotificationsQueues = {
  EMAIL: 'notifications.email',
} as const;

export const EmailJobNames = {
  SEND_EMAIL_MESSAGE: 'send-email-message',
} as const;

export interface SendEmailMessageJobPayload {
  emailMessageId: string;
}

export const EmailJobIds = {
  emailMessage: (emailMessageId: string): string => `email-message-${emailMessageId.replace(/:/g, '-')}`,
} as const;
