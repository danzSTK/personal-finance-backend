import { Test, TestingModule } from '@nestjs/testing';
import { Profile } from 'passport-google-oauth20';
import googleOauthConfig from '@/config/google-oauth.config';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import { AuthProviderLinkedToAnotherUserError } from '@/modules/auth/application/errors';
import { LinkGoogleProviderUseCase } from '@/modules/auth/application/use-cases/link-google-provider/link-google-provider.use-case';
import { GoogleLinkStrategy } from './google-link.strategy';
import { AuthProviderType } from '@/common/models/enums';

describe('GoogleLinkStrategy', () => {
  let strategy: GoogleLinkStrategy;
  let redisService: RedisService;
  let linkGoogleProviderUseCase: LinkGoogleProviderUseCase;

  const mockProfile = {
    id: 'google-user-id',
  } as Profile;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleLinkStrategy,
        {
          provide: googleOauthConfig.KEY,
          useValue: {
            clientID: 'google-client-id',
            clientSecret: 'google-client-secret',
            callbackURL: 'http://localhost:3000/auth/google/callback',
            linkCallbackUri: 'http://localhost:3000/auth/providers/link/google/callback',
          },
        },
        {
          provide: RedisService,
          useValue: {
            getAndDelete: jest.fn(),
          },
        },
        {
          provide: LinkGoogleProviderUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<GoogleLinkStrategy>(GoogleLinkStrategy);
    redisService = module.get<RedisService>(RedisService);
    linkGoogleProviderUseCase = module.get<LinkGoogleProviderUseCase>(LinkGoogleProviderUseCase);
  });

  it('deve retornar missing_state quando state não for enviado no callback', async () => {
    const result = await strategy.validate(
      { query: {} } as unknown as Parameters<GoogleLinkStrategy['validate']>[0],
      '',
      '',
      mockProfile,
    );

    expect(result).toEqual({ success: false, errorCode: 'missing_state' });
  });

  it('deve retornar invalid_state quando state não existir no Redis', async () => {
    const getAndDeleteSpy = jest.spyOn(redisService, 'getAndDelete').mockResolvedValue(null);

    const result = await strategy.validate(
      { query: { state: 'state-id' } } as unknown as Parameters<GoogleLinkStrategy['validate']>[0],
      '',
      '',
      mockProfile,
    );

    expect(getAndDeleteSpy).toHaveBeenCalledWith(CacheKeys.auth.googleLinkState('state-id'));
    expect(result).toEqual({ success: false, errorCode: 'invalid_state' });
  });

  it('deve vincular provider Google quando state for válido', async () => {
    const getAndDeleteSpy = jest.spyOn(redisService, 'getAndDelete').mockResolvedValue('user-id');
    const executeSpy = jest.spyOn(linkGoogleProviderUseCase, 'execute').mockResolvedValue(undefined);

    const result = await strategy.validate(
      { query: { state: 'valid-state' } } as unknown as Parameters<GoogleLinkStrategy['validate']>[0],
      '',
      '',
      mockProfile,
    );

    expect(getAndDeleteSpy).toHaveBeenCalledWith(CacheKeys.auth.googleLinkState('valid-state'));
    expect(executeSpy).toHaveBeenCalledWith({
      userId: 'user-id',
      googleId: 'google-user-id',
    });
    expect(result).toEqual({ success: true });
  });

  it('deve retornar google_provider_conflict quando o vínculo já existir', async () => {
    jest.spyOn(redisService, 'getAndDelete').mockResolvedValue('user-id');
    jest
      .spyOn(linkGoogleProviderUseCase, 'execute')
      .mockRejectedValue(new AuthProviderLinkedToAnotherUserError(AuthProviderType.GOOGLE));

    const result = await strategy.validate(
      { query: { state: 'valid-state' } } as unknown as Parameters<GoogleLinkStrategy['validate']>[0],
      '',
      '',
      mockProfile,
    );

    expect(result).toEqual({ success: false, errorCode: 'google_provider_conflict' });
  });
});
