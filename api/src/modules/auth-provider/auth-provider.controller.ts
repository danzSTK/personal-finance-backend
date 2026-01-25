import { Controller, Get } from '@nestjs/common';
import { AuthProviderService } from './auth-provider.service';

@Controller('auth-provider')
export class AuthProviderController {
  constructor(private readonly authProviderService: AuthProviderService) {}

  @Get()
  async getAuthProviders() {
    const providers = await this.authProviderService.getAuthProviders();
    return providers;
  }
}
