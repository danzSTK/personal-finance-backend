import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AppEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit(event: DomainEvent): boolean {
    return this.eventEmitter.emit(event.eventName, event);
  }

  emitAll(events: DomainEvent[]): void {
    events.forEach(event => this.emit(event));
  }

  async emitAsync(event: DomainEvent): Promise<unknown[]> {
    return (await this.eventEmitter.emitAsync(event.eventName, event)) as unknown[];
  }
}
