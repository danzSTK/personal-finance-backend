import { ActiveSession, SessionMetadata } from '@/common/models/interfaces';

export abstract class ISessionRepository {
  abstract createSession(userId: string, jti: string, metadata: SessionMetadata, ttlSeconds: number): Promise<void>;

  abstract getSession(userId: string, jti: string): Promise<SessionMetadata | null>;

  abstract revokeSession(userId: string, jti: string): Promise<void>;

  abstract revokeAllSessions(userId: string): Promise<void>;

  abstract getActiveSessions(userId: string): Promise<ActiveSession[]>;

  abstract sessionExists(userId: string, jti: string): Promise<boolean>;

  abstract blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void>;

  abstract isAccessTokenBlacklisted(jti: string): Promise<boolean>;
}
