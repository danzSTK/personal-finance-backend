import { EmailTemplateSourceValidator } from '@/modules/notifications/infrastructure/templates/email-template-source.validator';

const validHtml = (placeholder = 'first_name'): string => `<!doctype html>
<html lang="pt-BR">
  <head><title>Template</title></head>
  <body>
    <div style="display:none">Preheader</div>
    <table role="presentation"><tr><td>{{ params.${placeholder} }}</td></tr></table>
    <img src="https://example.com/logo.png" alt="Danfy">
  </body>
</html>`;

describe('EmailTemplateSourceValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAll', () => {
    it('validates every registered source in the canonical backend directory', () => {
      const result = EmailTemplateSourceValidator.validateAll();

      expect(result).toHaveLength(4);
      expect(result.map(template => `${template.key}:v${template.version}`)).toEqual(
        expect.arrayContaining([
          'welcome-email:v1',
          'email-verification:v1',
          'password-changed:v1',
          'password-change-blocked:v1',
        ]),
      );
    });
  });

  describe('validateHtml', () => {
    it('accepts a structurally valid HTML with an exact parameter contract', () => {
      expect(() =>
        EmailTemplateSourceValidator.validateHtml('example-email', 1, ['first_name'], validHtml()),
      ).not.toThrow();
    });

    it('rejects unknown placeholders', () => {
      expect(() =>
        EmailTemplateSourceValidator.validateHtml('example-email', 1, ['first_name'], validHtml('secret')),
      ).toThrow('uses unknown params: secret');
    });

    it('rejects declared parameters that are absent from the HTML', () => {
      expect(() =>
        EmailTemplateSourceValidator.validateHtml('example-email', 1, ['first_name', 'support_url'], validHtml()),
      ).toThrow('does not use declared params: support_url');
    });

    it('rejects unsafe HTML elements', () => {
      expect(() =>
        EmailTemplateSourceValidator.validateHtml(
          'example-email',
          1,
          ['first_name'],
          validHtml().replace('</body>', '<script>alert(1)</script></body>'),
        ),
      ).toThrow('contains a forbidden HTML element');
    });

    it('rejects local or non-HTTPS assets', () => {
      expect(() =>
        EmailTemplateSourceValidator.validateHtml(
          'example-email',
          1,
          ['first_name'],
          validHtml().replace('https://example.com/logo.png', './logo.png'),
        ),
      ).toThrow('contains a non-HTTPS or local image source');
    });

    it('rejects local links while accepting links supplied by declared params', () => {
      const html = validHtml().replace('{{ params.first_name }}', '<a href="/dashboard">{{ params.first_name }}</a>');

      expect(() => EmailTemplateSourceValidator.validateHtml('example-email', 1, ['first_name'], html)).toThrow(
        'contains a non-HTTPS or local link',
      );
    });
  });
});
