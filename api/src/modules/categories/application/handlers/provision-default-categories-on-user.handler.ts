import { ProvisionDefaultCategoriesUseCase } from '@/modules/categories/application/use-cases/provision-default-categories/provision-default-categories.use-case';
import { ProvisionDefaultCategoriesUseCaseOutput } from '@/modules/categories/application/use-cases/provision-default-categories/provision-default-categories.dto';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class ProvisionDefaultCategoriesOnUserHandler {
  constructor(private readonly provisionDefaultCategoriesUseCase: ProvisionDefaultCategoriesUseCase) {}

  @OnEvent(UserCreatedEvent.eventName, { suppressErrors: false })
  async handle(event: UserCreatedEvent): Promise<ProvisionDefaultCategoriesUseCaseOutput> {
    return await this.provisionDefaultCategoriesUseCase.execute({
      userId: event.userId,
    });
  }
}
