import { ConfigModule } from '@/config/config.module';
import mailConfig from '@/config/mail.config';
import { BrevoMailProvider } from '@/shared/mail/adapters/brevo-mail.provider';
import { NoopMailProvider } from '@/shared/mail/adapters/noop-mail.provider';
import { MailProviderName } from '@/shared/mail/constants/mail.constants';
import { MailProvider } from '@/shared/mail/interfaces/mail-provider.interface';
import { BrevoClientProvider } from '@/shared/mail/providers/brevo-client.provider';
import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({
  imports: [ConfigModule],
  providers: [
    BrevoClientProvider,
    BrevoMailProvider,
    NoopMailProvider,
    {
      provide: MailProvider,
      inject: [mailConfig.KEY, BrevoMailProvider, NoopMailProvider],
      useFactory: (
        config: ConfigType<typeof mailConfig>,
        brevoMailProvider: BrevoMailProvider,
        noopMailProvider: NoopMailProvider,
      ): MailProvider => {
        if (!config.enabled || config.provider === MailProviderName.NOOP) {
          return noopMailProvider;
        }

        return brevoMailProvider;
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
