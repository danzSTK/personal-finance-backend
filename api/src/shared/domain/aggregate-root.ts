import { DomainEvent } from './domain-event.interface';

export class AggregateRoot {
  private readonly domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];

    this.domainEvents.length = 0; // Clear the events after pulling

    return events;
  }
}
