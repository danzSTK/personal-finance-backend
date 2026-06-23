import { CreateDefaultAccountUseCase } from '@/modules/accounts/application/use-cases/create-default-account/create-default-account.use-case';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class ProvisionDefaultAccountOnUserHandler {
  constructor(private readonly createDefaultAccountUseCase: CreateDefaultAccountUseCase) {}
  @OnEvent(UserCreatedEvent.eventName, { suppressErrors: false })
  async handle(event: UserCreatedEvent): Promise<Account> {
    // TODO: Implement provisioning of default account for the user based on the event data (event.userId, event.status)
    return await this.createDefaultAccountUseCase.execute({ userId: event.userId });
  }
}
