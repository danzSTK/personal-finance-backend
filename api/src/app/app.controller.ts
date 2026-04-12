import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('app')
@Controller()
export class AppController {
  constructor() {}

  @Get()
  @ApiOperation({
    summary: 'Status público da API',
    description: 'Retorna uma mensagem simples para validar que a API está no ar.',
  })
  @ApiResponse({
    status: 200,
    description: 'API respondendo normalmente',
    schema: {
      type: 'string',
      example: 'Personal Finance App API is running!',
    },
  })
  getAppInfo() {
    return 'Personal Finance App API is running!';
  }
}
