import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { resolveTrustedClientIp } from '@/common/utils/client-ip.util';
import { RedisService } from '@/database/redis/redis.service';
import { PasswordChangeCostLimitedError } from '@/modules/auth/application/errors/password-change-cost-limit.error';
import { PASSWORD_CHANGE_COST_LIMITS } from '@/modules/auth/domain/constants/password-change.constants';
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

const INCREMENT_COST_LIMITS_SCRIPT = String.raw`
local ip_count = redis.call('INCR', KEYS[1])
if ip_count == 1 or redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end

local session_count = redis.call('INCR', KEYS[2])
if session_count == 1 or redis.call('PTTL', KEYS[2]) < 0 then
  redis.call('PEXPIRE', KEYS[2], ARGV[2])
end

return {
  ip_count,
  redis.call('PTTL', KEYS[1]),
  session_count,
  redis.call('PTTL', KEYS[2])
}
`;

@Injectable()
export class PasswordChangeCostGuard implements CanActivate {
  private readonly logger = new Logger(PasswordChangeCostGuard.name);
  private readonly hmacSecret: string;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.hmacSecret = config.getOrThrow<string>('PASSWORD_CHANGE_RATE_LIMIT_HMAC_SECRET');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const sessionJti = request.authToken?.jti;

    if (!sessionJti) {
      return false;
    }

    const clientIp = resolveTrustedClientIp(request);

    if (!clientIp) {
      return false;
    }

    const keys = [
      CacheKeys.auth.passwordChange.costByIp(this.fingerPrint(clientIp)),
      CacheKeys.auth.passwordChange.costBySession(this.fingerPrint(sessionJti)),
    ];

    try {
      const raw = await this.redis
        .getClient()
        .eval(
          INCREMENT_COST_LIMITS_SCRIPT,
          keys.length,
          ...keys,
          PASSWORD_CHANGE_COST_LIMITS.ip.windowMs,
          PASSWORD_CHANGE_COST_LIMITS.session.windowMs,
        );

      if (!Array.isArray(raw) || raw.length !== 4) {
        throw new Error('Invalid password change cost limiter response.');
      }

      const [ipCount, ipTtlMs, sessionCount, sessionTtlMs] = raw.map(Number);

      const retryAfterMs = Math.max(
        ipCount > PASSWORD_CHANGE_COST_LIMITS.ip.limit ? ipTtlMs : 0,
        sessionCount > PASSWORD_CHANGE_COST_LIMITS.session.limit ? sessionTtlMs : 0,
      );

      if (retryAfterMs > 0) {
        throw new PasswordChangeCostLimitedError(Math.max(1, Math.ceil(retryAfterMs / 1_000)));
      }
    } catch (error: unknown) {
      if (error instanceof PasswordChangeCostLimitedError) {
        throw error;
      }

      this.logger.warn('Password change technical limiter unavailable; user policy remains active.');
    }

    return true;
  }

  private fingerPrint(value: string): string {
    return createHmac('sha256', this.hmacSecret).update(value).digest('base64url');
  }
}
