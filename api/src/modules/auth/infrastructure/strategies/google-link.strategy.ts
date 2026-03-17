import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { type ConfigType } from '@nestjs/config';
import googleOauthConfig from '../../../../config/google-oauth.config';
import { LinkGoogleProviderUseCase } from '../../application/use-cases/link-google-provider/link-google-provider.use-case';

/**
 * 🔗 GoogleLinkStrategy
 *
 * Estratégia especializada para vincular contas Google a usuários já autenticados.
 * Diferente do GoogleStrategy normal (que faz login/signup), esta estratégia:
 *
 * 1. Recebe um state UUID gerado pelo controller
 * 2. O state mapeia para um userId armazenado temporariamente no Redis
 * 3. Após OAuth, vincula o googleId ao userId recuperado
 *
 * ⚠️ IMPORTANTE: O userId é recuperado do state no controller, não aqui.
 */
@Injectable()
export class GoogleLinkStrategy extends PassportStrategy(Strategy, 'google-link') {
  constructor(
    @Inject(googleOauthConfig.KEY)
    private readonly googleOauthConfiguration: ConfigType<typeof googleOauthConfig>,
    private readonly linkGoogleProviderUseCase: LinkGoogleProviderUseCase,
  ) {
    // Usa uma callback URL diferente para não conflitar com login/signup
    const callbackURL = googleOauthConfiguration.callbackURL.replace('/callback', '/link/callback');

    super({
      clientID: googleOauthConfiguration.clientID,
      clientSecret: googleOauthConfiguration.clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: true, // Necessário para acessar req.query.state
    });
  }

  async validate(req: any, accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback): Promise<void> {
    try {
      const { id } = profile;

      // Retorna o googleId e state para que o controller processe
      // O controller irá usar o state para recuperar o userId do Redis
      done(null, { googleId: id, state: req.query.state });
    } catch (error) {
      done(error, false);
    }
  }
}
