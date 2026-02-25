// api/src/database/redis/redis.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.provider';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ═══════════════════════════════════════════
  //  Cache Helpers (substitui o CACHE_MANAGER)
  // ═══════════════════════════════════════════

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;

    const isJsonObject = (data.startsWith('{') && data.endsWith('}')) || (data.startsWith('[') && data.endsWith(']'));

    if (isJsonObject) {
      try {
        return JSON.parse(data) as T;
      } catch {
        return data as unknown as T;
      }
    }

    return data as unknown as T;
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const serialized = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

    if (ttlMs) {
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // ═══════════════════════════════════════════
  //  Comandos Nativos do Redis
  // ═══════════════════════════════════════════

  async exists(key: string): Promise<number> {
    return this.redis.exists(key);
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    return this.redis.setex(key, seconds, value);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redis.expire(key, seconds);
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return this.redis.mget(...keys);
  }

  // Sets
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.redis.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.redis.srem(key, ...members);
  }

  // Acesso direto ao client (para o ThrottlerStorage na Fase 2)
  getClient(): Redis {
    return this.redis;
  }
}
