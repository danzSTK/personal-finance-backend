import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../database/redis/redis.service';

@Controller('health')
export class AppController {
  constructor(private readonly redisService: RedisService) {}

  @Get('redis')
  async checkRedis() {
    try {
      // Tenta salvar e recuperar um valor
      await this.redisService.set('test_key', 'test_value', 10000);
      const value = await this.redisService.get<string>('test_key');

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
