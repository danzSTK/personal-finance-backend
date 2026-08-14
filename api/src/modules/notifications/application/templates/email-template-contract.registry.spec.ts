import {
  EmailTemplateContractError,
  EmailTemplateContractErrorCode,
} from '@/modules/notifications/application/errors/email-template-contract.error';
import { EmailTemplateContractRegistry } from '@/modules/notifications/application/templates/email-template-contract.registry';
import {
  EmailTemplateKey,
  EmailTemplateVersion,
} from '@/modules/notifications/domain/templates/email-template.contract';

const captureContractError = (operation: () => void): EmailTemplateContractError => {
  try {
    operation();
  } catch (error) {
    if (error instanceof EmailTemplateContractError) {
      return error;
    }

    throw error;
  }

  throw new Error('Expected an email template contract error.');
};

describe('EmailTemplateContractRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('accepts the exact welcome email v1 contract', () => {
      const params = {
        first_name: 'Daniel',
        dashboard_url: 'https://app.danfy.com/dashboard',
        support_url: 'https://danfy.com/suporte',
        support_url_label: 'Central de ajuda',
        preferences_url: 'https://app.danfy.com/settings/email-preferences',
      };

      const result = EmailTemplateContractRegistry.validate(EmailTemplateKey.WELCOME, EmailTemplateVersion.V1, params);

      expect(result).toEqual(params);
    });

    it('accepts the exact email verification v1 contract', () => {
      const params = {
        first_name: 'Daniel',
        verification_url: 'https://app.danfy.com/verification-email?token=token',
        expires_in_minutes: 15,
        support_url: 'https://danfy.com/suporte',
      };

      const result = EmailTemplateContractRegistry.validate(
        EmailTemplateKey.EMAIL_VERIFICATION,
        EmailTemplateVersion.V1,
        params,
      );

      expect(result).toEqual(params);
    });

    it('accepts the exact password changed v1 contract', () => {
      const params = {
        first_name: 'Daniel',
        changed_at: '11/08/2026 às 09:00',
        ip_address: '203.0.113.10',
        location: 'Fortaleza, CE',
        browser: 'Firefox',
        operating_system: 'Linux',
        device: 'Desktop',
        support_url: 'https://danfy.com/suporte',
      };

      expect(
        EmailTemplateContractRegistry.validate(EmailTemplateKey.PASSWORD_CHANGED, EmailTemplateVersion.V1, params),
      ).toEqual(params);
    });

    it('accepts the exact password change blocked v1 contract', () => {
      const params = {
        first_name: 'Daniel',
        blocked_until: '11/08/2026 às 10:00',
        ip_address: '203.0.113.10',
        location: 'Fortaleza, CE',
        browser: 'Firefox',
        operating_system: 'Linux',
        device: 'Desktop',
        support_url: 'https://danfy.com/suporte',
      };

      expect(
        EmailTemplateContractRegistry.validate(
          EmailTemplateKey.PASSWORD_CHANGE_BLOCKED,
          EmailTemplateVersion.V1,
          params,
        ),
      ).toEqual(params);
    });
  });

  describe('parse', () => {
    it('rejects unknown params without exposing their values', () => {
      const error = captureContractError(() =>
        EmailTemplateContractRegistry.parse(EmailTemplateKey.WELCOME, EmailTemplateVersion.V1, {
          first_name: 'Daniel',
          dashboard_url: 'https://app.danfy.com/dashboard',
          support_url: 'https://danfy.com/suporte',
          support_url_label: 'Central de ajuda',
          preferences_url: 'https://app.danfy.com/settings/email-preferences',
          secret: 'must-not-leak',
        }),
      );

      expect(error.code).toBe(EmailTemplateContractErrorCode.PARAMS_INVALID);
      expect(error.message).not.toContain('must-not-leak');
    });

    it('rejects an unknown template', () => {
      const error = captureContractError(() => EmailTemplateContractRegistry.parse('unknown-template', 1, {}));

      expect(error.code).toBe(EmailTemplateContractErrorCode.UNKNOWN);
    });

    it('rejects an unsupported version', () => {
      const error = captureContractError(() => EmailTemplateContractRegistry.parse(EmailTemplateKey.WELCOME, 2, {}));

      expect(error.code).toBe(EmailTemplateContractErrorCode.VERSION_UNSUPPORTED);
    });

    it('rejects URL protocols that cannot be used as safe web links', () => {
      const error = captureContractError(() =>
        EmailTemplateContractRegistry.parse(EmailTemplateKey.EMAIL_VERIFICATION, EmailTemplateVersion.V1, {
          first_name: 'Daniel',
          verification_url: 'javascript:alert(1)',
          expires_in_minutes: 15,
          support_url: 'https://danfy.com/suporte',
        }),
      );

      expect(error.code).toBe(EmailTemplateContractErrorCode.PARAMS_INVALID);
      expect(error.message).not.toContain('javascript:');
    });

    it('rejects a password change date outside the Brasilia display contract', () => {
      const error = captureContractError(() =>
        EmailTemplateContractRegistry.parse(EmailTemplateKey.PASSWORD_CHANGED, EmailTemplateVersion.V1, {
          first_name: 'Daniel',
          changed_at: '2026-08-11T12:00:00.000Z',
          ip_address: '203.0.113.10',
          location: 'Fortaleza, CE',
          browser: 'Firefox',
          operating_system: 'Linux',
          device: 'Desktop',
          support_url: 'https://danfy.com/suporte',
        }),
      );

      expect(error.code).toBe(EmailTemplateContractErrorCode.PARAMS_INVALID);
    });
  });

  describe('list', () => {
    it('exposes every version with its exact parameter names for source validation', () => {
      expect(EmailTemplateContractRegistry.list()).toEqual([
        {
          key: EmailTemplateKey.WELCOME,
          version: 1,
          parameterNames: ['first_name', 'dashboard_url', 'support_url', 'support_url_label', 'preferences_url'],
        },
        {
          key: EmailTemplateKey.EMAIL_VERIFICATION,
          version: 1,
          parameterNames: ['first_name', 'verification_url', 'expires_in_minutes', 'support_url'],
        },
        {
          key: EmailTemplateKey.PASSWORD_CHANGED,
          version: 1,
          parameterNames: [
            'first_name',
            'changed_at',
            'ip_address',
            'location',
            'browser',
            'operating_system',
            'device',
            'support_url',
          ],
        },
        {
          key: EmailTemplateKey.PASSWORD_CHANGE_BLOCKED,
          version: 1,
          parameterNames: [
            'first_name',
            'blocked_until',
            'ip_address',
            'location',
            'browser',
            'operating_system',
            'device',
            'support_url',
          ],
        },
      ]);
    });
  });
});
