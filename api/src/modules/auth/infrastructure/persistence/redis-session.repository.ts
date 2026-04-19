import { Injectable } from '@nestjs/common';
import { type ActiveSession, type SessionMetadata } from '@/common/models/interfaces';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import { ISessionRepository } from '@/modules/auth/domain/repositories/session.repository.interface';

@Injectable()
export class RedisSessionRepository implements ISessionRepository {
  constructor(private readonly redis: RedisService) {}

  async createSession(userId: string, jti: string, metadata: SessionMetadata, ttlSeconds: number): Promise<void> {
    const rtKey = CacheKeys.auth.refreshToken(userId, jti);
    const sessionKey = CacheKeys.auth.userSessions(userId);
    const rtValue = JSON.stringify(metadata);

    await this.redis.setex(rtKey, ttlSeconds, rtValue);
    await this.redis.sadd(sessionKey, jti);
    await this.redis.expire(sessionKey, ttlSeconds);
  }

  async getSession(userId: string, jti: string): Promise<SessionMetadata | null> {
    const rtKey = CacheKeys.auth.refreshToken(userId, jti);
    return this.redis.get<SessionMetadata>(rtKey);
  }

  async revokeSession(userId: string, jti: string): Promise<void> {
    const rtKey = CacheKeys.auth.refreshToken(userId, jti);
    const sessionKey = CacheKeys.auth.userSessions(userId);

    await Promise.all([this.redis.del(rtKey), this.redis.srem(sessionKey, jti)]);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const sessionKey = CacheKeys.auth.userSessions(userId);
    const jtis = await this.redis.smembers(sessionKey);

    if (jtis.length > 0) {
      const rtKeys = jtis.map(jti => CacheKeys.auth.refreshToken(userId, jti));

      await Promise.all([...rtKeys.map(key => this.redis.del(key)), this.redis.del(sessionKey)]);
    }
  }

  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const sessionKey = CacheKeys.auth.userSessions(userId);
    const jtis = await this.redis.smembers(sessionKey);

    if (jtis.length === 0) return [];

    const rtKeys = jtis.map(jti => CacheKeys.auth.refreshToken(userId, jti));
    const sessionsData = await this.redis.mget(...rtKeys);

    const staleJtis: string[] = [];

    const sessions = sessionsData
      .map((data, index) => {
        if (!data) {
          staleJtis.push(jtis[index]);
          return null;
        }

        try {
          const metadata = JSON.parse(data) as SessionMetadata;

          return {
            jti: jtis[index],
            ...metadata,
          };
        } catch {
          staleJtis.push(jtis[index]);
          return null;
        }
      })
      .filter((session): session is ActiveSession => session !== null);

    if (staleJtis.length > 0) {
      await this.redis.srem(sessionKey, ...staleJtis);
    }

    return sessions;
  }

  async sessionExists(userId: string, jti: string): Promise<boolean> {
    const rtKey = CacheKeys.auth.refreshToken(userId, jti);
    const result = await this.redis.exists(rtKey);
    return result > 0;
  }

  async blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    const blacklistKey = CacheKeys.auth.blackList(jti);
    await this.redis.setex(blacklistKey, ttlSeconds, '1');
  }

  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    const blacklistKey = CacheKeys.auth.blackList(jti);
    const result = await this.redis.exists(blacklistKey);
    return result > 0;
  }
}
