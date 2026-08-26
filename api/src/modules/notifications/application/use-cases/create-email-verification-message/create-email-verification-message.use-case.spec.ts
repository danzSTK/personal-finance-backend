import { EmailVerificationUserNotFoundError } from '@/modules/notifications/application/errors';
import { CreateEmailVerificationMessageUseCase } from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import appConfig from '@/config/app.config';
import notificationsConfig from '@/config/notifications.config';
import {
  EmailMessageStatus,
  EmailMessageType,
  EmailVerificationIdempotencyKeys,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import {
  EmailTemplateKey,
  EmailTemplateVersion,
} from '@/modules/notifications/domain/templates/email-template.contract';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { ConfigType } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';

const makeEmailMessage = (): EmailMessage =>
  EmailMessage.reconstitute(
    {
      type: EmailMessageType.EMAIL_VERIFICATION,
      recipientEmail: 'daniel@example.com',
      recipientName: 'Daniel',
      provider: null,
      templateKey: EmailTemplateKey.EMAIL_VERIFICATION,
      templateVersion: EmailTemplateVersion.V1,
      templateParams: {
        first_name: 'Daniel',
        verification_url: 'https://app.danfy.com/verification-email?token=token',
        expires_in_minutes: 15,
        support_url: 'https://danfy.com/suporte',
      },
      idempotencyKey: EmailVerificationIdempotencyKeys.challenge('challenge-1'),
      status: EmailMessageStatus.PENDING,
      providerMessageId: null,
      attemptsCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      processingAt: null,
      sentAt: null,
      failedAt: null,
      deliverBefore: new Date('2026-01-01T10:10:00.000Z'),
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

const makeUser = (): Awaited<ReturnType<IUserRepository['findById']>> =>
  ({
    firstName: 'Daniel',
    email: { value: 'daniel@example.com' },
  }) as Awaited<ReturnType<IUserRepository['findById']>>;

describe('CreateEmailVerificationMessageUseCase', () => {
  let emailMessageRepository: jest.Mocked<IEmailMessageRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let findByIdempotencyKey: jest.MockedFunction<IEmailMessageRepository['findByIdempotencyKey']>;
  let saveEmailMessage: jest.MockedFunction<IEmailMessageRepository['save']>;
  let findUserById: jest.MockedFunction<IUserRepository['findById']>;
  let useCase: CreateEmailVerificationMessageUseCase;

  beforeEach(() => {
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

    useCase = new CreateEmailVerificationMessageUseCase(
      emailMessageRepository,
      userRepository,
      {
        url: 'https://api.danfy.com',
        nodeEnv: 'test',
        frontendUrl: 'https://app.danfy.com',
        csrfAllowedOrigins: 'https://app.danfy.com',
      } as ConfigType<typeof appConfig>,
      {
        emailVerificationPath: '/verification-email',
        emailVerificationTokenTtlMinutes: 15,
        supportUrl: 'https://danfy.com/suporte',
      } as ConfigType<typeof notificationsConfig>,
    );
  });

  describe('execute', () => {
    it('creates a v1 logical intent with validated and encoded params', async () => {
      findByIdempotencyKey.mockResolvedValue(null);
      findUserById.mockResolvedValue(makeUser());
      saveEmailMessage.mockImplementation(message => Promise.resolve(message));

      const result = await useCase.execute({
        userId: 'user-1',
        challengeId: 'challenge-1',
        email: 'event-email@example.com',
        token: 'token+/with=special?characters',
        deliverBefore: new Date(Date.now() + 10 * 60 * 1_000),
      });

      expect(result.created).toBe(true);
      expect(result.shouldEnqueue).toBe(true);
      expect(result.emailMessage?.provider).toBeNull();
      expect(result.emailMessage?.templateKey).toBe(EmailTemplateKey.EMAIL_VERIFICATION);
      expect(result.emailMessage?.templateVersion).toBe(EmailTemplateVersion.V1);
      expect(result.emailMessage?.templateParams).toEqual({
        first_name: 'Daniel',
        verification_url: 'https://app.danfy.com/verification-email?token=token%2B%2Fwith%3Dspecial%3Fcharacters',
        expires_in_minutes: 15,
        support_url: 'https://danfy.com/suporte',
      });
    });

    it('returns an existing message without rebuilding the sensitive URL', async () => {
      const existingMessage = makeEmailMessage();
      findByIdempotencyKey.mockResolvedValue(existingMessage);

      const result = await useCase.execute({
        userId: 'user-1',
        challengeId: 'challenge-1',
        email: 'daniel@example.com',
        token: null,
        deliverBefore: new Date(Date.now() + 10 * 60 * 1_000),
      });

      expect(result).toEqual({ emailMessage: existingMessage, created: false, shouldEnqueue: true });
      expect(findUserById).not.toHaveBeenCalled();
      expect(saveEmailMessage).not.toHaveBeenCalled();
    });

    it('does not create an intent when the challenge token is unavailable', async () => {
      findByIdempotencyKey.mockResolvedValue(null);

      const result = await useCase.execute({
        userId: 'user-1',
        challengeId: 'challenge-1',
        email: 'daniel@example.com',
        token: null,
        deliverBefore: new Date(Date.now() + 10 * 60 * 1_000),
      });

      expect(result).toEqual({ emailMessage: null, created: false, shouldEnqueue: false });
      expect(findUserById).not.toHaveBeenCalled();
      expect(saveEmailMessage).not.toHaveBeenCalled();
    });

    it('fails safely when the referenced user does not exist', async () => {
      findByIdempotencyKey.mockResolvedValue(null);
      findUserById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'user-1',
          challengeId: 'challenge-1',
          email: 'daniel@example.com',
          token: 'token',
          deliverBefore: new Date(Date.now() + 10 * 60 * 1_000),
        }),
      ).rejects.toBeInstanceOf(EmailVerificationUserNotFoundError);
      expect(saveEmailMessage).not.toHaveBeenCalled();
    });

    it('treats a concurrent idempotency conflict as success', async () => {
      const concurrentMessage = makeEmailMessage();
      findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(concurrentMessage);
      findUserById.mockResolvedValue(makeUser());
      saveEmailMessage.mockRejectedValue(makeUniqueViolation());

      const result = await useCase.execute({
        userId: 'user-1',
        challengeId: 'challenge-1',
        email: 'daniel@example.com',
        token: 'token',
        deliverBefore: new Date(Date.now() + 10 * 60 * 1_000),
      });

      expect(result).toEqual({ emailMessage: concurrentMessage, created: false, shouldEnqueue: true });
    });
  });
});
