import { OutboxMessageStatus } from '@/common/models/enums';
import type { WorkerConfig } from '@/config/worker.config';
import type { DomainEvent } from '@/shared/domain/domain-event.interface';
import type { AppEventPublisher } from '@/shared/events';
import type { EventRegistry } from '@/shared/outbox/event-registry';
import type { OutboxMessageOrmEntity } from '@/shared/outbox/persistence/outbox-message-orm.entity';
import type { OutboxMessageRepository } from '@/shared/outbox/persistence/outbox-message.repository';
import type { EventEmitterReadinessWatcher } from '@nestjs/event-emitter';
import { OutboxProcessorService } from './outbox-processor.service';

describe('OutboxProcessorService', () => {
  let repository: jest.Mocked<OutboxMessageRepository>;
  let eventPublisher: jest.Mocked<AppEventPublisher>;
  let eventRegistry: jest.Mocked<EventRegistry>;
  let eventEmitterReadiness: jest.Mocked<EventEmitterReadinessWatcher>;
  let service: OutboxProcessorService;
  let claimReadyBatch: jest.Mock;
  let markPublished: jest.Mock;
  let markFailed: jest.Mock;
  let extendLease: jest.Mock;
  let emitAsync: jest.Mock;
  let waitUntilReady: jest.Mock;

  const config: WorkerConfig = {
    outbox: {
      pollIntervalMs: 1_000,
      batchSize: 25,
      concurrency: 5,
      leaseMs: 30_000,
      leaseRenewIntervalMs: 100,
    },
    emailReconciliation: { intervalMs: 30_000, batchSize: 100, staleAfterMs: 30_000 },
    shutdownTimeoutMs: 1_000,
    heartbeat: { intervalMs: 10_000, ttlMs: 30_000 },
  };

  const message = {
    id: '1d6cfa20-f911-4520-9e06-dbc70cd3cf09',
    eventName: 'test.event',
    eventVersion: 1,
    aggregateType: 'Test',
    aggregateId: '87e6155f-9d41-463c-8329-b483960a3755',
    deduplicationKey: null,
    payload: {},
    metadata: {},
    status: OutboxMessageStatus.PROCESSING,
    attempts: 1,
    maxAttempts: 5,
    nextRetryAt: null,
    lockedBy: 'previous-owner',
    lockedUntil: new Date(),
    lastError: null,
    occurredAt: new Date(),
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as OutboxMessageOrmEntity;

  const event = {
    eventName: 'test.event',
    eventVersion: 1,
    aggregateType: 'Test',
    aggregateId: message.aggregateId,
    occurredAt: message.occurredAt,
    toPayload: () => ({}),
  } satisfies DomainEvent;

  beforeEach(() => {
    jest.clearAllMocks();
    claimReadyBatch = jest.fn().mockResolvedValue([]);
    markPublished = jest.fn().mockResolvedValue(true);
    markFailed = jest.fn().mockResolvedValue(true);
    extendLease = jest.fn().mockResolvedValue(true);
    emitAsync = jest.fn().mockResolvedValue([]);
    repository = {
      claimReadyBatch,
      markPublished,
      markFailed,
      extendLease,
    } as unknown as jest.Mocked<OutboxMessageRepository>;
    eventPublisher = {
      emitAsync,
    } as unknown as jest.Mocked<AppEventPublisher>;
    eventRegistry = {
      rehydrate: jest.fn().mockReturnValue(event),
    } as unknown as jest.Mocked<EventRegistry>;
    waitUntilReady = jest.fn().mockResolvedValue(undefined);
    eventEmitterReadiness = {
      waitUntilReady,
    } as unknown as jest.Mocked<EventEmitterReadinessWatcher>;
    service = new OutboxProcessorService(repository, eventPublisher, eventRegistry, eventEmitterReadiness, config);
  });

  afterEach(async () => {
    await service.beforeApplicationShutdown();
    jest.useRealTimers();
  });

  describe('processReadyMessages', () => {
    it('claims only the configured concurrency capacity and publishes with its ownership token', async () => {
      claimReadyBatch.mockResolvedValue([message]);

      await service.processReadyMessages();

      expect(claimReadyBatch).toHaveBeenCalledWith({
        lockedBy: expect.stringMatching(/^outbox-/) as string,
        limit: 5,
        lockForMs: 30_000,
      });
      expect(markPublished).toHaveBeenCalledWith(message.id, expect.stringMatching(/^outbox-/));
    });

    it('renews the lease while a handler is active', async () => {
      jest.useFakeTimers();
      claimReadyBatch.mockResolvedValue([message]);
      let finishHandler: (() => void) | undefined;
      emitAsync.mockImplementation(
        async () =>
          await new Promise<unknown[]>(resolve => {
            finishHandler = () => resolve([]);
          }),
      );

      const processing = service.processReadyMessages();
      await Promise.resolve();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(100);

      expect(extendLease).toHaveBeenCalledWith(message.id, expect.stringMatching(/^outbox-/), 30_000);

      finishHandler?.();
      await processing;
    });

    it('uses the ownership token when recording a retryable failure', async () => {
      const error = new Error('handler failed');
      claimReadyBatch.mockResolvedValue([message]);
      emitAsync.mockRejectedValue(error);

      await service.processReadyMessages();

      expect(markFailed).toHaveBeenCalledWith(message, expect.stringMatching(/^outbox-/), error);
    });

    it('does not overwrite state after losing ownership during publication', async () => {
      claimReadyBatch.mockResolvedValue([message]);
      markPublished.mockResolvedValue(false);

      await service.processReadyMessages();

      expect(markPublished).toHaveBeenCalledTimes(1);
      expect(markFailed).not.toHaveBeenCalled();
    });

    it('does not claim new messages after shutdown starts', async () => {
      await service.beforeApplicationShutdown();

      await service.processReadyMessages();

      expect(claimReadyBatch).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('does not claim messages before EventEmitter listeners are ready', async () => {
      let markReady: (() => void) | undefined;
      waitUntilReady.mockImplementation(
        async () =>
          await new Promise<void>(resolve => {
            markReady = resolve;
          }),
      );

      const starting = service.start();
      await Promise.resolve();

      expect(claimReadyBatch).not.toHaveBeenCalled();

      markReady?.();
      await starting;
      await Promise.resolve();

      expect(claimReadyBatch).toHaveBeenCalledTimes(1);
    });

    it('starts polling only once', async () => {
      await service.start();
      await service.start();
      await Promise.resolve();

      expect(waitUntilReady).toHaveBeenCalledTimes(1);
      expect(claimReadyBatch).toHaveBeenCalledTimes(1);
    });
  });
});
