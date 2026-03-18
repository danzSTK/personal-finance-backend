import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { CacheKeys } from '../../../../common/utils/cache-keys.factory';
import { RedisService } from '../../../../database/redis/redis.service';
import { User } from '../../../users/domain/entities/user.entity';

interface GoogleLinkInitRequest extends Request {
  user: User;
  googleLinkState?: string;
}

const GOOGLE_LINK_STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class GoogleLinkInitAuthGuard extends AuthGuard('google-link') {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GoogleLinkInitRequest>();

    if (!request.user?.id) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    const state = randomUUID();
    request.googleLinkState = state;

    await this.redisService.set(CacheKeys.auth.googleLinkState(state), request.user.id, GOOGLE_LINK_STATE_TTL_MS);

    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext): { state: string } {
    const request = context.switchToHttp().getRequest<GoogleLinkInitRequest>();

    if (!request.googleLinkState) {
      throw new UnauthorizedException('Google link state not initialized');
    }

    return {
      state: request.googleLinkState,
    };
  }
}
