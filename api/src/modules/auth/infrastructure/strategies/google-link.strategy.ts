import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { type Request } from 'express';
import { Profile, Strategy } from 'passport-google-oauth20';
import googleOauthConfig from '@/config/google-oauth.config';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import { LinkGoogleProviderUseCase } from '@/modules/auth/application/use-cases/link-google-provider/link-google-provider.use-case';

type GoogleLinkErrorCode = 'missing_state' | 'invalid_state' | 'google_provider_conflict';

export type GoogleLinkAuthPayload =
  | {
      success: true;
    }
  | {
      success: false;
      errorCode: GoogleLinkErrorCode;
    };

type GoogleLinkRequest = Request<Record<string, never>, unknown, unknown, { state?: string | string[] }>;

@Injectable()
export class GoogleLinkStrategy extends PassportStrategy(Strategy, 'google-link') {
  constructor(
    @Inject(googleOauthConfig.KEY)
    private readonly googleOauthConfiguration: ConfigType<typeof googleOauthConfig>,
    private readonly redisService: RedisService,
    private readonly linkGoogleProviderUseCase: LinkGoogleProviderUseCase,
  ) {
    super({
      clientID: googleOauthConfiguration.clientID,
      clientSecret: googleOauthConfiguration.clientSecret,
      callbackURL: googleOauthConfiguration.linkCallbackUri,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: GoogleLinkRequest,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<GoogleLinkAuthPayload> {
    const state = this.extractState(req.query.state);

    if (!state) {
      return { success: false, errorCode: 'missing_state' };
    }

    const userId = await this.redisService.getAndDelete(CacheKeys.auth.googleLinkState(state));

    if (!userId) {
      return { success: false, errorCode: 'invalid_state' };
    }

    try {
      await this.linkGoogleProviderUseCase.execute({
        userId,
        googleId: profile.id,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ConflictException) {
        return { success: false, errorCode: 'google_provider_conflict' };
      }

      throw error;
    }
  }

  private extractState(state: string | string[] | undefined): string | null {
    if (Array.isArray(state)) {
      return state[0] ?? null;
    }

    if (typeof state !== 'string' || state.trim() === '') {
      return null;
    }

    return state;
  }
}
