import appConfig from '@/config/app.config';
import notificationsConfig from '@/config/notifications.config';
import {
  BrevoTemplateId,
  EmailMessageStatus,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
  WelcomeEmailIdempotencyKeys,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { CreateWelcomeEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-welcome-email-message/create-welcome-email-message.use-case';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { ConfigType } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';

const makeEmailMessage = (status = EmailMessageStatus.PENDING): EmailMessage =>
  EmailMessage.reconstitute(
    {
      type: EmailMessageType.WELCOME,
      recipientEmail: 'daniel@example.com',
      recipientName: 'Daniel',
      provider: EmailProviderKey.BREVO,
      templateKey: EmailTemplateKey.WELCOME,
      providerTemplateId: BrevoTemplateId.WELCOME,
      templateParams: {},
      idempotencyKey: WelcomeEmailIdempotencyKeys.user('user-1'),
      status,
      providerMessageId: null,
      attemptsCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      processingAt: null,
      sentAt: null,
      failedAt: null,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    },
    'email-message-1',
  );

const makeUniqueViolation = (): QueryFailedError =>
  new QueryFailedError('INSERT INTO email_messages', [], {
    name: 'QueryFailedError',
    message: 'duplicate key value violates unique constraint',
    code: '23505',
    constraint: 'UQ_email_messages_idempotency_key',
  } as Error & { code: string; constraint: string });

describe('CreateWelcomeEmailMessageUseCase', () => {
  let emailMessageRepository: jest.Mocked<IEmailMessageRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let findByIdempotencyKey: jest.MockedFunction<IEmailMessageRepository['findByIdempotencyKey']>;
  let saveEmailMessage: jest.MockedFunction<IEmailMessageRepository['save']>;
  let findUserById: jest.MockedFunction<IUserRepository['findById']>;
  let useCase: CreateWelcomeEmailMessageUseCase;

  beforeEach(() => {
    jest.clearAllMocks();

    findByIdempotencyKey = jest.fn();
    saveEmailMessage = jest.fn();
    findUserById = jest.fn();
    emailMessageRepository = {
      findById: jest.fn(),
      findByIdForUpdate: jest.fn(),
      findByIdempotencyKey,
      save: saveEmailMessage,
    };

    userRepository = {
      findById: findUserById,
      findByIdForUpdate: jest.fn(),
      findByEmail: jest.fn(),
      findByUserName: jest.fn(),
      findByAuthProvider: jest.fn(),
      usernameAlreadyExists: jest.fn(),
      save: jest.fn(),
    };

    useCase = new CreateWelcomeEmailMessageUseCase(
      emailMessageRepository,
      userRepository,
      {
        url: 'https://api.danfy.com',
        nodeEnv: 'test',
        frontendUrl: 'https://app.danfy.com',
        csrfAllowedOrigins: 'https://app.danfy.com',
      } as ConfigType<typeof appConfig>,
      {
        dashboardPath: '/dashboard',
        emailPreferencesPath: '/settings/email-preferences',
        supportUrl: 'https://danfy.com/suporte',
        supportUrlLabel: 'Central de ajuda',
      } as ConfigType<typeof notificationsConfig>,
    );
  });

  describe('execute', () => {
    it('creates a welcome email intent with documented template params', async () => {
      findByIdempotencyKey.mockResolvedValue(null);
      findUserById.mockResolvedValue({
        firstName: 'Daniel',
        email: { value: 'daniel@example.com' },
      } as Awaited<ReturnType<IUserRepository['findById']>>);
      saveEmailMessage.mockImplementation(emailMessage => Promise.resolve(emailMessage));

      const result = await useCase.execute({ userId: 'user-1', email: 'fallback@example.com' });

      expect(result.created).toBe(true);
      expect(result.shouldEnqueue).toBe(true);
      expect(result.emailMessage.idempotencyKey).toBe('email:welcome:user:user-1');
      expect(result.emailMessage.templateKey).toBe(EmailTemplateKey.WELCOME);
      expect(result.emailMessage.providerTemplateId).toBe('2');
      expect(result.emailMessage.templateParams).toEqual({
        first_name: 'Daniel',
        dashboard_url: 'https://app.danfy.com/dashboard',
        support_url: 'https://danfy.com/suporte',
        support_url_label: 'Central de ajuda',
        preferences_url: 'https://app.danfy.com/settings/email-preferences',
      });
    });

    it('returns an existing message as idempotent success', async () => {
      const existingMessage = makeEmailMessage();
      findByIdempotencyKey.mockResolvedValue(existingMessage);

      const result = await useCase.execute({ userId: 'user-1', email: 'daniel@example.com' });

      expect(result.created).toBe(false);
      expect(result.shouldEnqueue).toBe(true);
      expect(result.emailMessage).toBe(existingMessage);
      expect(saveEmailMessage).not.toHaveBeenCalled();
    });

    it('treats concurrent idempotency unique violation as success', async () => {
      const concurrentMessage = makeEmailMessage();
      findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(concurrentMessage);
      findUserById.mockResolvedValue(null);
      saveEmailMessage.mockRejectedValue(makeUniqueViolation());

      const result = await useCase.execute({ userId: 'user-1', email: 'daniel@example.com' });

      expect(result.created).toBe(false);
      expect(result.shouldEnqueue).toBe(true);
      expect(result.emailMessage).toBe(concurrentMessage);
    });

    it('does not enqueue terminal existing messages', async () => {
      const sentMessage = makeEmailMessage(EmailMessageStatus.SENT);
      findByIdempotencyKey.mockResolvedValue(sentMessage);

      const result = await useCase.execute({ userId: 'user-1', email: 'daniel@example.com' });

      expect(result.created).toBe(false);
      expect(result.shouldEnqueue).toBe(false);
    });
  });
});
