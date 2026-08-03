/* eslint-disable @typescript-eslint/unbound-method */
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { PasswordChangeEventOrmEntity } from '@/modules/auth/infrastructure/persistence/password-change-event-orm.entity';
import { PasswordChangeEventRepository } from '@/modules/auth/infrastructure/persistence/password-change-event.repository';
import { EntityManager, FindManyOptions, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';

describe('PasswordChangeEventRepository', () => {
  const userId = randomUUID();
  const occurredAt = new Date('2026-07-30T12:00:00.000Z');

  const makeEvent = (): PasswordChangeEvent =>
    PasswordChangeEvent.currentPasswordFailed(
      {
        userId,
        authProviderId: randomUUID(),
        occurredAt,
      },
      randomUUID(),
    );

  describe('findRelevantEvents', () => {
    it('filters by user and lower temporal bound and maps results', async () => {
      const event = makeEvent();
      const persisted = PasswordChangeEventMapperFixture(event) as PasswordChangeEventOrmEntity;
      const find = jest.fn().mockResolvedValue([persisted]);
      const repository = new PasswordChangeEventRepository({
        find,
      } as unknown as Repository<PasswordChangeEventOrmEntity>);
      const since = new Date('2026-07-29T12:00:00.000Z');

      await expect(repository.findRelevantEvents(userId, since)).resolves.toEqual([
        expect.objectContaining({
          id: event.id,
          userId,
        }),
      ]);
      const [findOptions] = find.mock.calls[0] as unknown as [FindManyOptions<PasswordChangeEventOrmEntity>];
      expect(findOptions.where).toMatchObject({ userId });
      expect(findOptions.order).toEqual({
        occurredAt: 'DESC',
        createdAt: 'DESC',
      });
    });
  });

  describe('saveAll', () => {
    it('uses the transaction manager repository when provided', async () => {
      const event = makeEvent();
      const create = jest.fn(
        (value: Partial<PasswordChangeEventOrmEntity>): Partial<PasswordChangeEventOrmEntity> => value,
      );
      const save = jest.fn(
        (values: Partial<PasswordChangeEventOrmEntity>[]): Promise<Partial<PasswordChangeEventOrmEntity>[]> =>
          Promise.resolve(values),
      );
      const transactionalRepository = {
        create,
        save,
      } as unknown as Repository<PasswordChangeEventOrmEntity>;
      const manager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
      } as unknown as EntityManager;
      const repository = new PasswordChangeEventRepository({} as Repository<PasswordChangeEventOrmEntity>);

      await repository.saveAll([event], { manager });

      expect(manager.getRepository).toHaveBeenCalledWith(PasswordChangeEventOrmEntity);
      expect(create).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('does not issue a database write for an empty collection', async () => {
      const save = jest.fn();
      const repository = new PasswordChangeEventRepository({
        save,
      } as unknown as Repository<PasswordChangeEventOrmEntity>);

      await expect(repository.saveAll([])).resolves.toEqual([]);
      expect(save).not.toHaveBeenCalled();
    });
  });
});

const PasswordChangeEventMapperFixture = (event: PasswordChangeEvent): Partial<PasswordChangeEventOrmEntity> => ({
  id: event.id,
  userId: event.userId,
  authProviderId: event.authProviderId,
  eventType: event.eventType,
  blockedUntil: event.blockedUntil,
  sessionId: event.sessionId,
  ipAddress: event.ipAddress,
  userAgent: event.userAgent,
  metadata: { ...event.metadata },
  occurredAt: event.occurredAt,
  createdAt: event.createdAt,
});
