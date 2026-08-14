/* eslint-disable @typescript-eslint/unbound-method */
import { PasswordChangeOperationPendingError } from '@/modules/auth/application/errors/password-change-operation-pending.error';
import { PasswordChangeStateUnavailableError } from '@/modules/auth/application/errors/password-change-state-unavailable.error';
import {
  IPasswordChangeStateStore,
  PasswordChangeStateLoadResultKind,
} from '@/modules/auth/application/ports/password-change-state-store.interface';
import { PasswordChangeStateAssembler } from '@/modules/auth/application/services/password-change-state.assembler';
import { PasswordChangeStateLoader } from '@/modules/auth/application/services/password-change-state-loader';
import { IPasswordChangeEventRepository } from '@/modules/auth/domain/repositories/password-change-event.repository.interface';

describe('PasswordChangeStateLoader', () => {
  const now = new Date('2026-07-30T12:00:00.000Z');
  const userId = '70a2a29c-8195-48a0-87c1-5fe6b99ef24a';
  const readyState = {
    failedAttemptsInWindow: 2,
    blockedUntil: null,
    lastBlockStartedAt: null,
    completedChangesAt: [],
  };
  let stateStore: jest.Mocked<IPasswordChangeStateStore>;
  let eventRepository: jest.Mocked<IPasswordChangeEventRepository>;
  let loader: PasswordChangeStateLoader;

  beforeEach(() => {
    stateStore = {
      load: jest.fn(),
      beginMutation: jest.fn(),
      replace: jest.fn(),
      clear: jest.fn(),
    };
    eventRepository = {
      findRelevantEvents: jest.fn(),
      findActiveBlock: jest.fn(),
      save: jest.fn(),
      saveAll: jest.fn(),
    };
    loader = new PasswordChangeStateLoader(stateStore, eventRepository, new PasswordChangeStateAssembler());
  });

  describe('load', () => {
    it('returns READY without querying PostgreSQL', async () => {
      stateStore.load.mockResolvedValue({
        kind: PasswordChangeStateLoadResultKind.READY,
        state: readyState,
      });

      await expect(loader.load(userId, now)).resolves.toEqual({ state: readyState });
      expect(eventRepository.findRelevantEvents).not.toHaveBeenCalled();
    });

    it('hydrates PostgreSQL and replaces Redis when state is missing', async () => {
      stateStore.load.mockResolvedValue({
        kind: PasswordChangeStateLoadResultKind.MISSING,
      });
      eventRepository.findRelevantEvents.mockResolvedValue([]);

      await expect(loader.load(userId, now)).resolves.toEqual({
        state: {
          failedAttemptsInWindow: 0,
          blockedUntil: null,
          lastBlockStartedAt: null,
          completedChangesAt: [],
        },
      });
      expect(eventRepository.findRelevantEvents).toHaveBeenCalledTimes(1);
      expect(stateStore.replace).toHaveBeenCalledTimes(1);
    });

    it('preserves the pending PTTL in the application error', async () => {
      stateStore.load.mockResolvedValue({
        kind: PasswordChangeStateLoadResultKind.PENDING,
        retryAfterSeconds: 37,
      });

      await expect(loader.load(userId, now)).rejects.toMatchObject<Partial<PasswordChangeOperationPendingError>>({
        code: 'PASSWORD_CHANGE_OPERATION_PENDING',
        retryAfterSeconds: 37,
      });
    });

    it('fails closed when Redis load is unavailable', async () => {
      stateStore.load.mockRejectedValue(new Error('redis unavailable'));

      await expect(loader.load(userId, now)).rejects.toBeInstanceOf(PasswordChangeStateUnavailableError);
    });

    it('fails closed when the hydrated projection cannot be stored', async () => {
      stateStore.load.mockResolvedValue({
        kind: PasswordChangeStateLoadResultKind.MISSING,
      });
      eventRepository.findRelevantEvents.mockResolvedValue([]);
      stateStore.replace.mockRejectedValue(new Error('redis unavailable'));

      await expect(loader.load(userId, now)).rejects.toBeInstanceOf(PasswordChangeStateUnavailableError);
    });
  });
});
