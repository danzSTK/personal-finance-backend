import notificationsConfig from '@/config/notifications.config';
import { PasswordChangeNotificationUserNotFoundError } from '@/modules/notifications/application/errors';
import { CreatePasswordChangedEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-password-changed-email-message/create-password-changed-email-message.use-case';
import {
  EmailMessageStatus,
  EmailMessageType,
  PasswordChangedEmailIdempotencyKeys,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import {
  EmailTemplateKey,
  EmailTemplateVersion,
} from '@/modules/notifications/domain/templates/email-template.contract';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Test } from '@nestjs/testing';
import type { ConfigType } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';

const occurredAt = new Date('2026-08-11T12:00:00.000Z');
const securityContext = {
  ipAddress: '203.0.113.10',
  location: 'Fortaleza, CE',
  browser: 'Firefox',
  operatingSystem: 'Linux',
  device: 'Desktop',
};

const makeEmailMessage = (status: EmailMessageStatus = EmailMessageStatus.PENDING): EmailMessage =>
  EmailMessage.reconstitute(
    {
      type: EmailMessageType.PASSWORD_CHANGED,
      recipientEmail: 'daniel@example.com',
      recipientName: 'Daniel',
      provider: null,
      templateKey: EmailTemplateKey.PASSWORD_CHANGED,
      templateVersion: EmailTemplateVersion.V1,
      templateParams: {},
      idempotencyKey: PasswordChangedEmailIdempotencyKeys.event('password-event-1'),
      status,
      providerMessageId: null,
      attemptsCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      processingAt: null,
      sentAt: null,
      failedAt: null,
      deliverBefore: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
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

const makeUser = (
  firstName: string | null = 'Daniel',
  email = 'daniel@example.com',
): Awaited<ReturnType<IUserRepository['findById']>> =>
  ({
    firstName,
    email: { value: email },
  }) as Awaited<ReturnType<IUserRepository['findById']>>;

describe('CreatePasswordChangedEmailMessageUseCase', () => {
  let emailMessageRepository: jest.Mocked<IEmailMessageRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let findByIdempotencyKey: jest.MockedFunction<IEmailMessageRepository['findByIdempotencyKey']>;
  let saveEmailMessage: jest.MockedFunction<IEmailMessageRepository['save']>;
  let findUserById: jest.MockedFunction<IUserRepository['findById']>;
  let useCase: CreatePasswordChangedEmailMessageUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();

    findByIdempotencyKey = jest.fn();
    saveEmailMessage = jest.fn();
    findUserById = jest.fn();
    emailMessageRepository = {
      findById: jest.fn(),
      findByIdForUpdate: jest.fn(),
      findByIdempotencyKey,
      findReenqueuableBefore: jest.fn(),
      save: saveEmailMessage,
    };
    userRepository = {
      findById: findUserById,
      findByIdForUpdate: jest.fn(),
      findCredentialVersionById: jest.fn(),
      findByEmail: jest.fn(),
      findByUserName: jest.fn(),
      findByAuthProvider: jest.fn(),
      usernameAlreadyExists: jest.fn(),
      save: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreatePasswordChangedEmailMessageUseCase,
        { provide: IEmailMessageRepository, useValue: emailMessageRepository },
        { provide: IUserRepository, useValue: userRepository },
        {
          provide: notificationsConfig.KEY,
          useValue: {
            supportUrl: 'https://danfy.com/suporte',
          } as ConfigType<typeof notificationsConfig>,
        },
      ],
    }).compile();

    useCase = moduleRef.get(CreatePasswordChangedEmailMessageUseCase);
  });

  describe('execute', () => {
    it('creates a password changed intent from the persisted user and event context', async () => {
      findByIdempotencyKey.mockResolvedValue(null);
      findUserById.mockResolvedValue(makeUser());
      saveEmailMessage.mockImplementation(message => Promise.resolve(message));

      const result = await useCase.execute({
        userId: 'user-1',
        sourceEventId: 'password-event-1',
        occurredAt,
        securityContext,
      });

      expect(result.created).toBe(true);
      expect(result.shouldEnqueue).toBe(true);
      expect(result.emailMessage).toBeInstanceOf(EmailMessage);
      expect(result.emailMessage.type).toBe(EmailMessageType.PASSWORD_CHANGED);
      expect(result.emailMessage.recipientEmail).toBe('daniel@example.com');
      expect(result.emailMessage.templateKey).toBe(EmailTemplateKey.PASSWORD_CHANGED);
      expect(result.emailMessage.templateVersion).toBe(EmailTemplateVersion.V1);
      expect(result.emailMessage.idempotencyKey).toBe('email:password-change:event:password-event-1');
      expect(result.emailMessage.templateParams).toEqual({
        first_name: 'Daniel',
        changed_at: '11/08/2026 às 09:00',
        ip_address: '203.0.113.10',
        location: 'Fortaleza, CE',
        browser: 'Firefox',
        operating_system: 'Linux',
        device: 'Desktop',
        support_url: 'https://danfy.com/suporte',
      });
      expect(saveEmailMessage).toHaveBeenCalledWith(expect.any(EmailMessage));
    });

    it('uses safe fallbacks for a missing name and incomplete security context', async () => {
      findByIdempotencyKey.mockResolvedValue(null);
      findUserById.mockResolvedValue(makeUser('   ', 'fallback@example.com'));
      saveEmailMessage.mockImplementation(message => Promise.resolve(message));

      const result = await useCase.execute({
        userId: 'user-1',
        sourceEventId: 'password-event-1',
        occurredAt,
        securityContext: {
          ipAddress: null,
          location: ' ',
          browser: null,
          operatingSystem: null,
          device: null,
        },
      });

      expect(result.emailMessage.templateParams).toEqual({
        first_name: 'fallback',
        changed_at: '11/08/2026 às 09:00',
        ip_address: 'Não identificado',
        location: 'Não identificado',
        browser: 'Não identificado',
        operating_system: 'Não identificado',
        device: 'Não identificado',
        support_url: 'https://danfy.com/suporte',
      });
    });

    it('returns an existing reenqueuable intent without loading the user', async () => {
      const existingMessage = makeEmailMessage(EmailMessageStatus.FAILED_RETRYABLE);
      findByIdempotencyKey.mockResolvedValue(existingMessage);

      const result = await useCase.execute({
        userId: 'user-1',
        sourceEventId: 'password-event-1',
        occurredAt,
        securityContext,
      });

      expect(result).toEqual({ emailMessage: existingMessage, created: false, shouldEnqueue: true });
      expect(findUserById).not.toHaveBeenCalled();
      expect(saveEmailMessage).not.toHaveBeenCalled();
    });

    it('does not reenqueue an existing terminal intent', async () => {
      const sentMessage = makeEmailMessage(EmailMessageStatus.SENT);
      findByIdempotencyKey.mockResolvedValue(sentMessage);

      const result = await useCase.execute({
        userId: 'user-1',
        sourceEventId: 'password-event-1',
        occurredAt,
        securityContext,
      });

      expect(result.shouldEnqueue).toBe(false);
      expect(saveEmailMessage).not.toHaveBeenCalled();
    });

    it('fails when the user referenced by the event no longer exists', async () => {
      findByIdempotencyKey.mockResolvedValue(null);
      findUserById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'user-1',
          sourceEventId: 'password-event-1',
          occurredAt,
          securityContext,
        }),
      ).rejects.toBeInstanceOf(PasswordChangeNotificationUserNotFoundError);
      expect(saveEmailMessage).not.toHaveBeenCalled();
    });

    it('treats a concurrent idempotency conflict as success', async () => {
      const concurrentMessage = makeEmailMessage();
      findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(concurrentMessage);
      findUserById.mockResolvedValue(makeUser());
      saveEmailMessage.mockRejectedValue(makeUniqueViolation());

      const result = await useCase.execute({
        userId: 'user-1',
        sourceEventId: 'password-event-1',
        occurredAt,
        securityContext,
      });

      expect(result).toEqual({ emailMessage: concurrentMessage, created: false, shouldEnqueue: true });
    });

    it('rethrows an idempotency conflict when the concurrent intent cannot be loaded', async () => {
      const conflict = makeUniqueViolation();
      findByIdempotencyKey.mockResolvedValue(null);
      findUserById.mockResolvedValue(makeUser());
      saveEmailMessage.mockRejectedValue(conflict);

      await expect(
        useCase.execute({
          userId: 'user-1',
          sourceEventId: 'password-event-1',
          occurredAt,
          securityContext,
        }),
      ).rejects.toBe(conflict);
      expect(findByIdempotencyKey).toHaveBeenCalledTimes(2);
    });

    it('rethrows a persistence error that is not the idempotency conflict', async () => {
      const persistenceError = new Error('database unavailable');
      findByIdempotencyKey.mockResolvedValue(null);
      findUserById.mockResolvedValue(makeUser());
      saveEmailMessage.mockRejectedValue(persistenceError);

      await expect(
        useCase.execute({
          userId: 'user-1',
          sourceEventId: 'password-event-1',
          occurredAt,
          securityContext,
        }),
      ).rejects.toBe(persistenceError);
    });
  });
});
