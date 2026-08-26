import { PasswordChangedEvent } from '@/modules/auth/domain/events/password-changed.event';
import { EnqueuePasswordChangedEmailHandler } from '@/modules/notifications/application/handlers/enqueue-password-changed-email.handler';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { CreatePasswordChangedEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-password-changed-email-message/create-password-changed-email-message.use-case';
import { EmailMessageStatus, EmailMessageType } from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import {
  EmailTemplateKey,
  EmailTemplateVersion,
} from '@/modules/notifications/domain/templates/email-template.contract';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

const occurredAt = new Date('2026-08-11T12:00:00.000Z');
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
      type: EmailMessageType.PASSWORD_CHANGED,
      recipientEmail: 'daniel@example.com',
      recipientName: 'Daniel',
      provider: null,
      templateKey: EmailTemplateKey.PASSWORD_CHANGED,
      templateVersion: EmailTemplateVersion.V1,
      templateParams: {},
      idempotencyKey: 'email:password-change:event:password-event-1',
      status: EmailMessageStatus.PENDING,
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

describe('EnqueuePasswordChangedEmailHandler', () => {
  let createEmailMessage: jest.Mocked<CreatePasswordChangedEmailMessageUseCase>;
  let emailJobQueueProducer: jest.Mocked<EmailJobQueueProducer>;
  let execute: jest.MockedFunction<CreatePasswordChangedEmailMessageUseCase['execute']>;
  let enqueueEmailMessage: jest.MockedFunction<EmailJobQueueProducer['enqueueEmailMessage']>;
  let handler: EnqueuePasswordChangedEmailHandler;
  let eventEmitter: EventEmitter2;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();

    execute = jest.fn();
    enqueueEmailMessage = jest.fn();
    createEmailMessage = { execute } as unknown as jest.Mocked<CreatePasswordChangedEmailMessageUseCase>;
    emailJobQueueProducer = { enqueueEmailMessage };
    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        EnqueuePasswordChangedEmailHandler,
        { provide: CreatePasswordChangedEmailMessageUseCase, useValue: createEmailMessage },
        { provide: EmailJobQueueProducer, useValue: emailJobQueueProducer },
      ],
    }).compile();
    await moduleRef.init();

    handler = moduleRef.get(EnqueuePasswordChangedEmailHandler);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe('event listener contract', () => {
    it('receives the canonical password changed event through EventEmitter', async () => {
      execute.mockResolvedValue({
        emailMessage: makeEmailMessage(),
        created: true,
        shouldEnqueue: true,
      });
      const event = PasswordChangedEvent.create('user-1', 'password-event-1', securityContext, occurredAt);

      await eventEmitter.emitAsync(PasswordChangedEvent.eventName, event);

      expect(execute).toHaveBeenCalledTimes(1);
      expect(enqueueEmailMessage).toHaveBeenCalledWith('email-message-1');
    });
  });

  describe('handle', () => {
    it('creates the idempotent intent and enqueues the email message', async () => {
      const emailMessage = makeEmailMessage();
      execute.mockResolvedValue({ emailMessage, created: true, shouldEnqueue: true });
      const event = PasswordChangedEvent.create('user-1', 'password-event-1', securityContext, occurredAt);

      await handler.handle(event);

      expect(execute).toHaveBeenCalledWith({
        userId: 'user-1',
        sourceEventId: 'password-event-1',
        occurredAt,
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
      const event = PasswordChangedEvent.create('user-1', 'password-event-1', securityContext, occurredAt);

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
      const event = PasswordChangedEvent.create('user-1', 'password-event-1', securityContext, occurredAt);

      await expect(handler.handle(event)).rejects.toThrow('queue unavailable');
    });
  });
});
