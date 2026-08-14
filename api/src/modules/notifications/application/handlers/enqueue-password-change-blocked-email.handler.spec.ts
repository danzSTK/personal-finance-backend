import { PasswordChangeBlockStartedEvent } from '@/modules/auth/domain/events/password-change-block-started.event';
import { EnqueuePasswordChangeBlockedEmailHandler } from '@/modules/notifications/application/handlers/enqueue-password-change-blocked-email.handler';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { CreatePasswordChangeBlockedEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-password-change-blocked-email-message/create-password-change-blocked-email-message.use-case';
import { EmailMessageStatus, EmailMessageType } from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import {
  EmailTemplateKey,
  EmailTemplateVersion,
} from '@/modules/notifications/domain/templates/email-template.contract';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

const occurredAt = new Date('2026-08-11T12:00:00.000Z');
const blockedUntil = new Date('2026-08-11T13:00:00.000Z');
const securityContext = {
  ipAddress: '203.0.113.10',
  location: 'Fortaleza, CE',
  browser: 'Firefox',
  operatingSystem: 'Linux',
  device: 'Desktop',
};

const makeEmailMessage = (): EmailMessage =>
  EmailMessage.reconstitute(
    {
      type: EmailMessageType.PASSWORD_CHANGE_BLOCKED,
      recipientEmail: 'daniel@example.com',
      recipientName: 'Daniel',
      provider: null,
      templateKey: EmailTemplateKey.PASSWORD_CHANGE_BLOCKED,
      templateVersion: EmailTemplateVersion.V1,
      templateParams: {},
      idempotencyKey: 'email:password-change:event:block-event-1',
      status: EmailMessageStatus.PENDING,
      providerMessageId: null,
      attemptsCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      processingAt: null,
      sentAt: null,
      failedAt: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    },
    'email-message-1',
  );

describe('EnqueuePasswordChangeBlockedEmailHandler', () => {
  let createEmailMessage: jest.Mocked<CreatePasswordChangeBlockedEmailMessageUseCase>;
  let emailJobQueueProducer: jest.Mocked<EmailJobQueueProducer>;
  let execute: jest.MockedFunction<CreatePasswordChangeBlockedEmailMessageUseCase['execute']>;
  let enqueueEmailMessage: jest.MockedFunction<EmailJobQueueProducer['enqueueEmailMessage']>;
  let handler: EnqueuePasswordChangeBlockedEmailHandler;
  let eventEmitter: EventEmitter2;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();

    execute = jest.fn();
    enqueueEmailMessage = jest.fn();
    createEmailMessage = { execute } as unknown as jest.Mocked<CreatePasswordChangeBlockedEmailMessageUseCase>;
    emailJobQueueProducer = { enqueueEmailMessage };
    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        EnqueuePasswordChangeBlockedEmailHandler,
        { provide: CreatePasswordChangeBlockedEmailMessageUseCase, useValue: createEmailMessage },
        { provide: EmailJobQueueProducer, useValue: emailJobQueueProducer },
      ],
    }).compile();
    await moduleRef.init();

    handler = moduleRef.get(EnqueuePasswordChangeBlockedEmailHandler);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe('event listener contract', () => {
    it('receives the canonical block started event through EventEmitter', async () => {
      execute.mockResolvedValue({
        emailMessage: makeEmailMessage(),
        created: true,
        shouldEnqueue: true,
      });
      const event = PasswordChangeBlockStartedEvent.create(
        'user-1',
        'block-event-1',
        blockedUntil,
        securityContext,
        occurredAt,
      );

      await eventEmitter.emitAsync(PasswordChangeBlockStartedEvent.eventName, event);

      expect(execute).toHaveBeenCalledTimes(1);
      expect(enqueueEmailMessage).toHaveBeenCalledWith('email-message-1');
    });
  });

  describe('handle', () => {
    it('creates the idempotent intent and enqueues the email message', async () => {
      const emailMessage = makeEmailMessage();
      execute.mockResolvedValue({ emailMessage, created: true, shouldEnqueue: true });
      const event = PasswordChangeBlockStartedEvent.create(
        'user-1',
        'block-event-1',
        blockedUntil,
        securityContext,
        occurredAt,
      );

      await handler.handle(event);

      expect(execute).toHaveBeenCalledWith({
        userId: 'user-1',
        sourceEventId: 'block-event-1',
        blockedUntil,
        securityContext,
      });
      expect(enqueueEmailMessage).toHaveBeenCalledWith('email-message-1');
    });

    it('does not enqueue an intent that is not eligible', async () => {
      execute.mockResolvedValue({
        emailMessage: makeEmailMessage(),
        created: false,
        shouldEnqueue: false,
      });
      const event = PasswordChangeBlockStartedEvent.create(
        'user-1',
        'block-event-1',
        blockedUntil,
        securityContext,
        occurredAt,
      );

      await handler.handle(event);

      expect(enqueueEmailMessage).not.toHaveBeenCalled();
    });

    it('propagates enqueue failures so the outbox can retry the event', async () => {
      execute.mockResolvedValue({
        emailMessage: makeEmailMessage(),
        created: true,
        shouldEnqueue: true,
      });
      enqueueEmailMessage.mockRejectedValue(new Error('queue unavailable'));
      const event = PasswordChangeBlockStartedEvent.create(
        'user-1',
        'block-event-1',
        blockedUntil,
        securityContext,
        occurredAt,
      );

      await expect(handler.handle(event)).rejects.toThrow('queue unavailable');
    });
  });
});
