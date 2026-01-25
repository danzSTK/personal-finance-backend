import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleOauthConfig from '../../../config/google-oauth.config';
import { type ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleOauthConfig.KEY)
    private readonly googleOauthConfiguration: ConfigType<
      typeof googleOauthConfig
    >,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: googleOauthConfiguration.clientID,
      clientSecret: googleOauthConfiguration.clientSecret,
      callbackURL: googleOauthConfiguration.callbackURL,
      scope: ['email', 'profile'],
    });
  }
  /**
   * 🧠 FLUXO:
   * 1. Usuário autoriza no Google
   * 2. Google redireciona com código
   * 3. Passport troca código por accessToken
   * 4. Google retorna perfil do usuário
   * 5. validate() é chamado com os dados
   * 6. Retorno é anexado em req.user
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, emails, displayName } = profile;

      const email = emails?.[0].value;

      if (!email) {
        return done(
          new UnauthorizedException(
            'Google account must have a verified email address',
          ),
          false,
        );
      }

      const user = await this.authService.validateOrCreateGoogleUser({
        googleId: id,
        email,
        name: displayName,
      });

      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }
}
