import { ListAccountTemplatesUseCaseOutput } from '@/modules/accounts/application/use-cases/list-account-templates/list-account-templates.dto';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ListAccountTemplatesUseCase {
  constructor(private readonly accountTemplateRepository: IAccountTemplateRepository) {}

  async execute(): Promise<ListAccountTemplatesUseCaseOutput> {
    return this.accountTemplateRepository.listActiveInstitutional();
  }
}
