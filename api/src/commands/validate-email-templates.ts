import { EmailTemplateSourceValidator } from '@/modules/notifications/infrastructure/templates/email-template-source.validator';

try {
  const templates = EmailTemplateSourceValidator.validateAll();
  console.log(`Validated ${templates.length} versioned email templates.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Email template validation failed.');
  process.exitCode = 1;
}
