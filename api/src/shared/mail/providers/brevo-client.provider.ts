import mailConfig from '@/config/mail.config';
import { BrevoClient } from '@getbrevo/brevo';
import { Provider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

export const BREVO_CLIENT = 'BREVO_CLIENT';

export type BrevoClientPort = Pick<BrevoClient, 'transactionalEmails'>;

export const BrevoClientProvider: Provider = {
  provide: BREVO_CLIENT,
  inject: [mailConfig.KEY],
  useFactory: (config: ConfigType<typeof mailConfig>): BrevoClientPort | null => {
    if (!config.enabled || config.provider !== 'brevo') {
      return null;
    }

    if (!config.brevo.apiKey) {
      throw new Error('BREVO_API_KEY is required when Brevo mail provider is enabled.');
    }

    return new BrevoClient({
      apiKey: config.brevo.apiKey,
      baseUrl: config.brevo.baseUrl,
      timeoutInSeconds: Math.ceil(config.brevo.timeoutMs / 1000),
      maxRetries: config.brevo.maxRetries,
    });
  },
};
