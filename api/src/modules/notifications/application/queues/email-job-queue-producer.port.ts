export abstract class EmailJobQueueProducer {
  abstract enqueueEmailMessage(emailMessageId: string): Promise<void>;
}
