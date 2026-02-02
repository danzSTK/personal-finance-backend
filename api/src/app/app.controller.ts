import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { type Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';

@Controller('health')
export class AppController {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('redis')
  async checkRedis() {
    try {
      // Tenta salvar e recuperar um valor
      await this.cacheManager.set('test_key', 'test_value', 10000);
      const value = await this.cacheManager.get('test_key');

      return {
        status: 'ok',
        message: 'Redis está funcionando',
        test: value === 'test_value',
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro ao conectar com Redis',
        error: (error as Error).message,
      };
    }
  }
}
