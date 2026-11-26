import observabilityConfig, { type ObservabilityConfig } from '@/config/observability.config';
import { OperationalAlertSeverities, REDACTED_VALUE } from '@/shared/observability/constants/observability.constants';
import {
  FormattedOperationalAlert,
  IOperationalAlertNotifier,
  OperationalAlertSeverity,
} from '@/shared/observability/contracts/operational-alert-notifier.interface';
import { Inject, Injectable } from '@nestjs/common';

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

const SEVERITY_EMOJI: Record<OperationalAlertSeverity, string> = {
  [OperationalAlertSeverities.CRITICAL]: '🚨',
  [OperationalAlertSeverities.WARN]: '⚠️',
  [OperationalAlertSeverities.RESOLVED]: '✅',
};

const SENSITIVE_METADATA_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'bottoken',
  'cpf',
  'cnpj',
  'consumerdocument',
  'consumername',
  'rawhtml',
  'authorization',
  'cookie',
  'set-cookie',
]);

const sanitizeSecret = (message: string, secret?: string): string => {
  if (!secret) {
    return message;
  }

  return message.split(secret).join(REDACTED_VALUE);
};

export const formatTelegramAlertMessage = (alert: FormattedOperationalAlert): string => {
  const emoji = SEVERITY_EMOJI[alert.severity];
  const lines: string[] = [
    `${emoji} [${alert.environment}] [${alert.severity}] ${alert.processRole.toUpperCase()} — ${alert.event}`,
    alert.title,
    alert.summary,
    `• alertKey: ${alert.alertKey}`,
  ];

  if (alert.requestId) {
    lines.push(`• requestId: ${alert.requestId}`);
  }

  if (alert.jobId) {
    lines.push(`• jobId: ${alert.jobId}`);
  }

  lines.push(`• processRole: ${alert.processRole}`);
  lines.push(`• time: ${alert.timestamp}`);

  if (alert.metadata) {
    for (const [key, value] of Object.entries(alert.metadata)) {
      if (value === undefined || value === null) {
        continue;
      }

      const displayValue = SENSITIVE_METADATA_KEYS.has(key.toLowerCase()) ? REDACTED_VALUE : String(value);
      lines.push(`• ${key}: ${displayValue}`);
    }
  }

  const fullMessage = lines.join('\n');
  if (fullMessage.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
    return fullMessage;
  }

  return `${fullMessage.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH - 3)}...`;
};

@Injectable()
export class TelegramOperationalAlertNotifier implements IOperationalAlertNotifier {
  constructor(
    @Inject(observabilityConfig.KEY)
    private readonly config: ObservabilityConfig,
  ) {}

  async send(alert: FormattedOperationalAlert): Promise<void> {
    const { botToken, chatId, apiBaseUrl, timeoutMs } = this.config.telegram;

    if (!botToken || !chatId) {
      throw new Error('Telegram operational alert credentials are not configured');
    }

    const endpoint = `${apiBaseUrl}/bot${botToken}/sendMessage`;
    const text = formatTelegramAlertMessage(alert);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Telegram request failed: ${sanitizeSecret(rawMessage, botToken)}`);
    }

    if (!response.ok) {
      throw new Error(`Telegram Bot API responded with HTTP ${response.status}`);
    }
  }
}
