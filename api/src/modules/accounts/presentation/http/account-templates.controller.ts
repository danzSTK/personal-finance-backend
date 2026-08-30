import { PlatformErrorResponseDto } from '@/common/dto/platform-error.response.dto';
import { ListAccountTemplatesUseCase } from '@/modules/accounts/application/use-cases/list-account-templates/list-account-templates.use-case';
import { AccountTemplateResponseDto } from '@/modules/accounts/presentation/dto/account-template.response.dto';
import { AccountTemplateResponseAssembler } from '@/modules/accounts/presentation/services/account-template-response.assembler';
import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('account-templates')
@Controller('account-templates')
export class AccountTemplatesController {
  constructor(
    private readonly listAccountTemplatesUseCase: ListAccountTemplatesUseCase,
    private readonly responseAssembler: AccountTemplateResponseAssembler,
  ) {}

  @Get()
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Listar templates institucionais ativos' })
  @ApiResponse({ status: 200, description: 'Catálogo institucional', type: [AccountTemplateResponseDto] })
  @ApiResponse({ status: 401, description: 'Sessão ausente ou inválida', type: PlatformErrorResponseDto })
  async list(): Promise<AccountTemplateResponseDto[]> {
    const templates = await this.listAccountTemplatesUseCase.execute();
    return templates.map(template => this.responseAssembler.toDto(template));
  }
}
