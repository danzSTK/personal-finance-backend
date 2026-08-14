/* eslint-disable @typescript-eslint/unbound-method */
import { IPasswordChangeStateStore } from '@/modules/auth/application/ports/password-change-state-store.interface';
import { PasswordChangeStateSynchronizer } from '@/modules/auth/application/services/password-change-state-synchronizer';
import { PasswordChangeStateAssembler } from '@/modules/auth/application/services/password-change-state.assembler';
import {
  PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
  PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS,
} from '@/modules/auth/domain/constants/password-change.constants';
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { IPasswordChangeEventRepository } from '@/modules/auth/domain/repositories/password-change-event.repository.interface';
import { randomUUID } from 'node:crypto';

describe('PasswordChangeStateSynchronizer', () => {
  const userId = randomUUID();
  const authProviderId = randomUUID();
  const mutationToken = randomUUID();
  const now = new Date('2026-07-30T12:00:00.000Z');
  let eventRepository: jest.Mocked<IPasswordChangeEventRepository>;
  let stateStore: jest.Mocked<IPasswordChangeStateStore>;
  let synchronizer: PasswordChangeStateSynchronizer;

  beforeEach(() => {
    jest.clearAllMocks();
    eventRepository = {
      findRelevantEvents: jest.fn(),
      findActiveBlock: jest.fn(),
      save: jest.fn(),
      saveAll: jest.fn(),
    };
    stateStore = {
      load: jest.fn(),
      beginMutation: jest.fn(),
      replace: jest.fn(),
      clear: jest.fn(),
    };
    synchronizer = new PasswordChangeStateSynchronizer(eventRepository, stateStore, new PasswordChangeStateAssembler());
  });

  describe('synchronize', () => {
    it('rebuilds the projection from the durable lookback and preserves the mutation owner', async () => {
      const changed = PasswordChangeEvent.passwordChanged(
        {
          userId,
          authProviderId,
          occurredAt: new Date(now.getTime() - 60_000),
        },
        randomUUID(),
      );
      eventRepository.findRelevantEvents.mockResolvedValue([changed]);

      await synchronizer.synchronize(userId, now, mutationToken);

      const lookbackMs = Math.max(
        PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
        PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS,
        PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS,
      );
      expect(eventRepository.findRelevantEvents).toHaveBeenCalledWith(userId, new Date(now.getTime() - lookbackMs));
      expect(stateStore.replace).toHaveBeenCalledWith(
        userId,
        {
          failedAttempts: [],
          completedChanges: [
            {
              eventId: changed.id,
              occurredAt: changed.occurredAt,
            },
          ],
          blockedUntil: null,
          lastBlockStartedAt: null,
        },
        now,
        mutationToken,
      );
    });

    it('does not hide repository failures or write a partial projection', async () => {
      eventRepository.findRelevantEvents.mockRejectedValue(new Error('database unavailable'));

      await expect(synchronizer.synchronize(userId, now, mutationToken)).rejects.toThrow('database unavailable');
      expect(stateStore.replace).not.toHaveBeenCalled();
    });
  });
});
