import type { DomainEvent } from '@/shared/domain/domain-event.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEventPublisher } from './app-event-publisher.service';

describe('AppEventPublisher', () => {
  const event = {
    eventName: 'test.event',
    eventVersion: 1,
    aggregateType: 'Test',
    aggregateId: '2f381ed5-2d41-4a7c-9bd7-7e3fb57a331b',
    occurredAt: new Date(),
    toPayload: () => ({}),
  } satisfies DomainEvent;

  let eventEmitter: EventEmitter2;
  let publisher: AppEventPublisher;

  beforeEach(() => {
    eventEmitter = new EventEmitter2();
    publisher = new AppEventPublisher(eventEmitter);
  });

  it('rejects async publication when the event has no listeners', async () => {
    await expect(publisher.emitAsync(event)).rejects.toThrow('No listeners registered for event test.event.');
  });

  it('publishes after a listener is registered', async () => {
    const listener = jest.fn().mockResolvedValue('handled');
    eventEmitter.on(event.eventName, listener);

    await expect(publisher.emitAsync(event)).resolves.toEqual(['handled']);
    expect(listener).toHaveBeenCalledWith(event);
  });
});
