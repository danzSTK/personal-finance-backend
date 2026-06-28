export abstract class EmailJobQueue {
  abstract enqueueEmailMessage(emailMessageId: string): Promise<void>;
}
