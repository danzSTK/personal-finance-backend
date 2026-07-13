import {
  BrevoTemplateId,
  EmailMessageStatus,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { EmailMessageRepository } from '@/modules/notifications/infrastructure/persistence/email-message.repository';
import { EmailMessageOrmEntity } from '@/modules/notifications/infrastructure/persistence/email-message-orm.entity';
import { Repository } from 'typeorm';

const makeOrmEntity = (): EmailMessageOrmEntity => ({
  id: 'email-message-1',
  type: EmailMessageType.WELCOME,
  recipient_email: 'daniel@example.com',
  recipient_name: 'Daniel',
  provider: EmailProviderKey.BREVO,
  template_key: EmailTemplateKey.WELCOME,
  provider_template_id: BrevoTemplateId.WELCOME,
  template_params: { first_name: 'Daniel' },
  idempotency_key: 'email:welcome:user:user-1',
  status: EmailMessageStatus.PENDING,
  provider_message_id: null,
  attempts_count: 0,
  last_error_code: null,
  last_error_message: null,
  processing_at: null,
  sent_at: null,
  failed_at: null,
  created_at: new Date('2026-01-01T10:00:00.000Z'),
  updated_at: new Date('2026-01-01T10:00:00.000Z'),
});

describe('EmailMessageRepository', () => {
  let typeormRepository: jest.Mocked<Repository<EmailMessageOrmEntity>>;
  let findOne: jest.MockedFunction<Repository<EmailMessageOrmEntity>['findOne']>;
  let saveOrm: jest.MockedFunction<Repository<EmailMessageOrmEntity>['save']>;
  let find: jest.MockedFunction<Repository<EmailMessageOrmEntity>['find']>;
  let repository: EmailMessageRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    findOne = jest.fn();
    saveOrm = jest.fn();
    find = jest.fn();
    typeormRepository = {
      findOne,
      save: saveOrm,
      find,
    } as unknown as jest.Mocked<Repository<EmailMessageOrmEntity>>;
    repository = new EmailMessageRepository(typeormRepository);
  });

  describe('findReenqueuableBefore', () => {
    it('selects only ids for retryable states using the status and creation index order', async () => {
      const cutoff = new Date('2026-01-01T10:00:00.000Z');
      find.mockResolvedValue([{ id: 'email-message-1' } as EmailMessageOrmEntity]);

      const result = await repository.findReenqueuableBefore(cutoff, 100);

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true },
          order: { created_at: 'ASC' },
          take: 100,
        }),
      );
      expect(result).toEqual([{ id: 'email-message-1' }]);
    });
  });

  describe('findByIdempotencyKey', () => {
    it('maps the ORM entity to domain', async () => {
      findOne.mockResolvedValue(makeOrmEntity());

      const result = await repository.findByIdempotencyKey('email:welcome:user:user-1');

      expect(findOne).toHaveBeenCalledWith({
        where: { idempotency_key: 'email:welcome:user:user-1' },
      });
      expect(result).toBeInstanceOf(EmailMessage);
      expect(result?.idempotencyKey).toBe('email:welcome:user:user-1');
    });
  });

  describe('save', () => {
    it('persists the mapped email message and returns the saved domain entity', async () => {
      const ormEntity = makeOrmEntity();
      const emailMessage = EmailMessage.reconstitute(
        {
          type: ormEntity.type,
          recipientEmail: ormEntity.recipient_email,
          recipientName: ormEntity.recipient_name,
          provider: ormEntity.provider,
          templateKey: ormEntity.template_key,
          providerTemplateId: ormEntity.provider_template_id,
          templateParams: ormEntity.template_params,
          idempotencyKey: ormEntity.idempotency_key,
          status: ormEntity.status,
          providerMessageId: ormEntity.provider_message_id,
          attemptsCount: ormEntity.attempts_count,
          lastErrorCode: ormEntity.last_error_code,
          lastErrorMessage: ormEntity.last_error_message,
          processingAt: ormEntity.processing_at,
          sentAt: ormEntity.sent_at,
          failedAt: ormEntity.failed_at,
          createdAt: ormEntity.created_at,
          updatedAt: ormEntity.updated_at,
        },
        ormEntity.id,
      );

      findOne.mockResolvedValue(ormEntity);

      const result = await repository.save(emailMessage);

      expect(saveOrm).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'email-message-1',
          idempotency_key: 'email:welcome:user:user-1',
          template_key: 'welcome-email',
        }),
      );
      expect(result.id).toBe('email-message-1');
    });
  });
});
