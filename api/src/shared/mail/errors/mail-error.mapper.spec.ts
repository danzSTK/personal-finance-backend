import { BrevoError, BrevoTimeoutError } from '@getbrevo/brevo';
import { MailErrorCode } from './mail-error';
import { MailErrorMapper } from './mail-error.mapper';

describe('MailErrorMapper', () => {
  describe('fromProviderError', () => {
    it('maps Brevo timeout errors to retryable timeout errors', () => {
      const error = MailErrorMapper.fromProviderError(new BrevoTimeoutError('timeout'));

      expect(error).toMatchObject({
        code: MailErrorCode.PROVIDER_TIMEOUT,
        retryable: true,
      });
    });

    it('maps retryable Brevo statuses to provider unavailable', () => {
      const error = MailErrorMapper.fromProviderError(new BrevoError({ statusCode: 503, message: 'unavailable' }));

      expect(error).toMatchObject({
        code: MailErrorCode.PROVIDER_UNAVAILABLE,
        retryable: true,
      });
    });

    it('maps non-retryable Brevo statuses to provider rejected', () => {
      const error = MailErrorMapper.fromProviderError(new BrevoError({ statusCode: 400, message: 'bad request' }));

      expect(error).toMatchObject({
        code: MailErrorCode.PROVIDER_REJECTED,
        retryable: false,
      });
    });

    it('maps unknown errors to retryable provider unknown', () => {
      const error = MailErrorMapper.fromProviderError(new Error('network failed'));

      expect(error).toMatchObject({
        code: MailErrorCode.PROVIDER_UNKNOWN,
        retryable: true,
      });
    });
  });
});
