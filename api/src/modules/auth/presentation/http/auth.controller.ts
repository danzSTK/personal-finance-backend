import { CurrentSessionInfo } from '@/common/decorators/current-session-info.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IsPublic } from '@/common/decorators/is-public.decorator';
import { RefreshToken } from '@/common/decorators/refresh-token.decorator';
import { UserProfileResponseDto } from '@/common/dto/user-profile.response.dto';
import { AUTH_CONSTANTS } from '@/common/models/constants';
import { type SessionMetadata } from '@/common/models/interfaces';
import { type AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import appConfig from '@/config/app.config';
import jwtConfig from '@/config/jwt.config';
import { RefreshTokenValidationService } from '@/modules/auth/application/services/refresh-token-validation.service';
import { GetActiveSessionsUseCase } from '@/modules/auth/application/use-cases/get-active-sessions/get-active-sessions.use-case';
import { LinkEmailProviderUseCase } from '@/modules/auth/application/use-cases/link-email-provider/link-email-provider.use-case';
import { LogoutUseCase } from '@/modules/auth/application/use-cases/logout/logout.use-case';
import { RefreshTokensUseCase } from '@/modules/auth/application/use-cases/refresh-tokens/refresh-tokens.use-case';
import { RevokeSessionUseCase } from '@/modules/auth/application/use-cases/revoke-session/revoke-session.use-case';
import { SignInUseCase } from '@/modules/auth/application/use-cases/sign-in/sign-in.use-case';
import { SignUpUseCase } from '@/modules/auth/application/use-cases/sign-up/sign-up.use-case';
import { GoogleAuthGuard } from '@/modules/auth/infrastructure/guards/google-auth.guard';
import { GoogleLinkAuthGuard } from '@/modules/auth/infrastructure/guards/google-link-auth.guard';
import { GoogleLinkInitAuthGuard } from '@/modules/auth/infrastructure/guards/google-link-init-auth.guard';
import { JwtRefreshGuard } from '@/modules/auth/infrastructure/guards/jwt-refresh.guard';
import { LocalAuthGuard } from '@/modules/auth/infrastructure/guards/local-auth.guard';
import { GoogleLinkAuthPayload } from '@/modules/auth/infrastructure/strategies/google-link.strategy';
import { type RefreshStrategyResponse } from '@/modules/auth/infrastructure/strategies/refresh-strategy-response.interface';
import { User } from '@/modules/users/domain/entities/user.entity';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import {
  ApiBody,
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import ms, { StringValue } from 'ms';
import { LinkEmailProviderDto } from '../dto/link-email-provider.dto';
import { LoginEmailDto } from '../dto/login-email.dto';
import { RegisterDto } from '../dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly signUpUseCase: SignUpUseCase,
    private readonly signInUseCase: SignInUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly refreshTokensUseCase: RefreshTokensUseCase,
    private readonly getActiveSessionsUseCase: GetActiveSessionsUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly linkEmailProviderUseCase: LinkEmailProviderUseCase,
    private readonly refreshTokenValidationService: RefreshTokenValidationService,

    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
  ) {}

  @Throttle({
    default: {
      ttl: AUTH_CONSTANTS.throttles.signup.ttl,
      limit: AUTH_CONSTANTS.throttles.signup.limit,
      blockDuration: AUTH_CONSTANTS.throttles.signup.blockDuration,
    },
  })
  @Post('sign-up')
  @IsPublic()
  @ApiOperation({
    summary: 'Registrar novo usuário',
    description: 'Cria uma nova conta e inicia sessão via cookies HttpOnly de access e refresh token.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado com sucesso',
    headers: {
      'Set-Cookie': {
        description:
          'Cookie HttpOnly contendo o refresh token. Ex.: refreshToken=<token>; HttpOnly; Path=/auth; Max-Age=604800;',
        schema: { type: 'string' },
        example: 'refreshToken=abc123; Path=/auth; HttpOnly; Secure; SameSite=Lax',
      },
    },
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        lastName: { type: 'string', example: 'Silva', nullable: true },
        firstName: { type: 'string', example: 'João', nullable: true },
        userName: { type: 'string', example: 'john_doe', nullable: true },
        email: { type: 'string', example: 'joao.silva@email.com' },
        status: { type: 'string', example: 'ACTIVE' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        providers: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Dados de registro inválidos' })
  @ApiResponse({ status: 409, description: 'E-mail ou username já cadastrado' })
  async signUp(
    @Body() signUpDto: RegisterDto,
    @CurrentSessionInfo() sessionInfo: SessionMetadata,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserProfileResponseDto> {
    const { accessToken, refreshToken, user } = await this.signUpUseCase.execute({
      email: signUpDto.email,
      password: signUpDto.password,
      firstName: signUpDto.firstName,
      lastName: signUpDto.lastName,
      userName: signUpDto.userName,
      sessionMetadata: sessionInfo,
    });

    this.setRefreshTokenCookie(res, refreshToken);
    this.setAccessTokenCookie(res, accessToken);

    return UserProfileResponseDto.fromEntity(user);
  }

  @Throttle({
    default: {
      ttl: AUTH_CONSTANTS.throttles.signin.ttl,
      limit: AUTH_CONSTANTS.throttles.signin.limit,
      blockDuration: AUTH_CONSTANTS.throttles.signin.blockDuration,
    },
  })
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @IsPublic()
  @UseGuards(LocalAuthGuard)
  @ApiOperation({
    summary: 'Autenticar usuário',
    description: 'Realiza login com e-mail e senha e autentica via cookies HttpOnly (access + refresh).',
  })
  @ApiBody({ type: LoginEmailDto })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        lastName: { type: 'string', example: 'Silva', nullable: true },
        firstName: { type: 'string', example: 'João', nullable: true },
        userName: { type: 'string', example: 'john_doe', nullable: true },
        email: { type: 'string', example: 'joao.silva@email.com' },
        status: { type: 'string', example: 'ACTIVE' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        providers: { type: 'array', items: { type: 'object' } },
      },
    },
    headers: {
      'Set-Cookie': {
        description:
          'Cookie HttpOnly contendo o refresh token. Ex.: refreshToken=<token>; HttpOnly; Path=/auth; Max-Age=604800;',
        schema: { type: 'string' },
        example: 'refreshToken=abc123; Path=/auth; HttpOnly; Secure; SameSite=Lax',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async signIn(
    @CurrentUser() user: User,
    @CurrentSessionInfo() sessionInfo: SessionMetadata,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserProfileResponseDto> {
    const { accessToken, refreshToken } = await this.signInUseCase.execute({
      userId: user.id,
      email: user.email.value,
      status: user.status,
      sessionMetadata: sessionInfo,
    });

    this.setRefreshTokenCookie(res, refreshToken);
    this.setAccessTokenCookie(res, accessToken);

    return UserProfileResponseDto.fromEntity(user);
  }

  @Throttle({
    default: {
      ttl: AUTH_CONSTANTS.throttles.signin.ttl,
      limit: AUTH_CONSTANTS.throttles.signin.limit,
      blockDuration: AUTH_CONSTANTS.throttles.signin.blockDuration,
    },
  })
  @Get('google')
  @IsPublic()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Iniciar login com Google',
    description: 'Redireciona o usuário para a tela de consentimento do Google OAuth.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redireciona para Google OAuth',
  })
  async googleAuth() {
    // Guard redireciona automaticamente
  }

  /**
   * 🔄 ROTA 2: Callback do Google
   * GET /auth/google/callback
   *
   * 🧠 FLUXO:
   * 1. Google redireciona aqui com código
   * 2. GoogleAuthGuard troca código por accessToken
   * 3. GoogleStrategy valida e anexa user em req.user
   * 4. Geramos JWT e redirecionamos para frontend
   */
  @Get('google/callback')
  @IsPublic()
  @UseGuards(GoogleAuthGuard)
  @ApiExcludeEndpoint()
  async googleAuthCallback(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
    @CurrentSessionInfo() sessionInfo: SessionMetadata,
  ) {
    const { accessToken, refreshToken } = await this.signInUseCase.execute({
      userId: user.id,
      email: user.email.value,
      status: user.status,
      sessionMetadata: sessionInfo,
    });

    this.setRefreshTokenCookie(res, refreshToken);
    this.setAccessTokenCookie(res, accessToken);

    const callbackUrl = new URL('/auth/callback', this.appConfiguration.frontendUrl).toString();

    return res.redirect(callbackUrl);
  }

  @Get('sessions')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Listar sessões ativas',
    description: 'Retorna todas as sessões ativas do usuário autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de sessões ativas',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          jti: { type: 'string', description: 'ID único da sessão' },
          isCurrent: { type: 'boolean', description: 'Indica se é a sessão atual' },
          browser: { type: 'string', description: 'Navegador' },
          os: { type: 'string', description: 'Sistema operacional' },
          device: { type: 'string', description: 'Tipo de dispositivo' },
          ip: { type: 'string', description: 'Endereço IP' },
          location: { type: 'string', description: 'Localização geográfica' },
          loginAt: { type: 'string', description: 'Data e hora do login' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  async getSessions(@CurrentUser() user: User, @RefreshToken() refreshToken: unknown) {
    const currentSessionJti = this.refreshTokenValidationService.getSessionJti(refreshToken);

    return this.getActiveSessionsUseCase.execute(user.id, currentSessionJti);
  }

  @Delete('sessions/:jti')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Revogar sessão',
    description: 'Encerra uma sessão específica, invalidando o refresh token associado.',
  })
  @ApiParam({
    name: 'jti',
    description: 'ID único da sessão (JWT ID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 204, description: 'Sessão revogada com sucesso' })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  async revokeSession(@CurrentUser() user: User, @Param('jti') jti: string) {
    await this.revokeSessionUseCase.execute({ userId: user.id, jti });
  }

  @Throttle({
    default: {
      ttl: 60000,
      limit: 5,
    },
  })
  @Post('refresh')
  @IsPublic()
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({
    summary: 'Renovar tokens',
    description:
      'Usa o refresh token (cookie HttpOnly) para gerar novos access e refresh tokens. Implementa rotação de tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados com sucesso',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Tokens refreshed successfully' },
      },
    },
    headers: {
      'Set-Cookie': {
        description: 'Novo refresh token via cookie HttpOnly',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido ou expirado' })
  async refresh(
    @CurrentUser() refreshStrategyResponse: RefreshStrategyResponse,
    @CurrentSessionInfo() sessionInfo: SessionMetadata,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const { accessToken, refreshToken } = await this.refreshTokensUseCase.execute({
      userId: refreshStrategyResponse.id,
      oldJti: refreshStrategyResponse.oldRefreshTokenJti,
      sessionMetadata: sessionInfo,
    });

    this.setRefreshTokenCookie(res, refreshToken);
    this.setAccessTokenCookie(res, accessToken);

    return { message: 'Tokens refreshed successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Encerrar sessão',
    description: 'Realiza logout invalidando o access token e o refresh token. Remove o cookie de sessão.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout realizado com sucesso',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  async logout(
    @CurrentUser() user: User,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken || typeof refreshToken !== 'string') {
      this.clearRefreshTokenCookie(res);
      this.clearAccessTokenCookie(res);
      throw new UnauthorizedException('Refresh token not found');
    }

    if (!accessToken || typeof accessToken !== 'string') {
      this.clearRefreshTokenCookie(res);
      this.clearAccessTokenCookie(res);
      throw new UnauthorizedException('Access token not found');
    }

    await this.logoutUseCase.execute({ userId: user.id, accessToken, refreshToken });

    this.clearRefreshTokenCookie(res);
    this.clearAccessTokenCookie(res);

    return { message: 'Logged out successfully' };
  }

  @Post('providers/link/email')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Vincular provider de email ao usuário autenticado',
    description: 'Permite que um usuário autenticado adicione email/senha como método de login à sua conta.',
  })
  @ApiBody({ type: LinkEmailProviderDto })
  @ApiResponse({
    status: 200,
    description: 'Provider de email vinculado com sucesso',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email provider linked successfully' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  @ApiResponse({ status: 409, description: 'Usuário já possui provider de email ou email já cadastrado' })
  async linkEmailProvider(
    @CurrentUser() user: User,
    @Body() linkEmailProviderDto: LinkEmailProviderDto,
    @CurrentSessionInfo() sessionInfo: SessionMetadata,
  ) {
    await this.linkEmailProviderUseCase.execute({
      userId: user.id,
      email: linkEmailProviderDto.email,
      password: linkEmailProviderDto.password,
      sessionMetadata: sessionInfo,
    });

    return { message: 'Email provider linked successfully' };
  }

  /**
   * 🔗 ROTA 1: Iniciar link do Google
   * GET /auth/providers/link/google
   *
   * 🧠 FLUXO:
   * 1. Usuário autenticado (JWT) inicia o fluxo
   * 2. Geramos um state UUID e armazenamos o userId no Redis
   * 3. Redirecionamos para OAuth do Google com o state
   */
  @UseGuards(GoogleLinkInitAuthGuard)
  @Get('providers/link/google')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Iniciar vínculo de conta Google',
    description: 'Inicia o fluxo OAuth do Google para vincular conta Google ao usuário autenticado.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redireciona para Google OAuth',
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  linkGoogle() {
    // Guards cuidam da autenticação JWT, state e redirect OAuth
  }

  /**
   * 🔗 ROTA 2: Callback do Google para link
   * GET /auth/providers/link/google/callback
   *
   * 🧠 FLUXO:
   * 1. Google redireciona aqui com código e state
   * 2. GoogleLinkAuthGuard troca código por accessToken
   * 3. GoogleLinkStrategy valida state, faz o vínculo e retorna o resultado em req.user
   * 4. Controller apenas redireciona para frontend com status final
   */
  @Get('providers/link/google/callback')
  @IsPublic()
  @UseGuards(GoogleLinkAuthGuard)
  @ApiExcludeEndpoint()
  linkGoogleCallback(@Req() req: Request, @Res() res: Response) {
    const googleLinkAuthPayload = req.user as GoogleLinkAuthPayload;
    const frontendUrl = this.appConfiguration.frontendUrl;

    if (!googleLinkAuthPayload.success) {
      return res.redirect(`${frontendUrl}/auth/link?error=${googleLinkAuthPayload.errorCode}`);
    }

    return res.redirect(`${frontendUrl}/auth/link?success=google`);
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie(AUTH_CONSTANTS.cookies.refreshTokenKey, refreshToken, {
      httpOnly: true,
      secure: AUTH_CONSTANTS.cookies.secure,
      sameSite: AUTH_CONSTANTS.cookies.sameSite,
      path: AUTH_CONSTANTS.cookies.refreshTokenPath,
      maxAge: ms(this.jwtConfiguration.refreshExpiresIn as StringValue),
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie(AUTH_CONSTANTS.cookies.refreshTokenKey, {
      path: AUTH_CONSTANTS.cookies.refreshTokenPath,
    });
  }

  private setAccessTokenCookie(res: Response, accessToken: string) {
    res.cookie(AUTH_CONSTANTS.cookies.accessTokenKey, accessToken, {
      httpOnly: true,
      secure: AUTH_CONSTANTS.cookies.secure,
      sameSite: AUTH_CONSTANTS.cookies.sameSite,
      path: AUTH_CONSTANTS.cookies.accessTokenPath,
      maxAge: ms(this.jwtConfiguration.accessExpiresIn as StringValue),
    });
  }

  private clearAccessTokenCookie(res: Response) {
    res.clearCookie(AUTH_CONSTANTS.cookies.accessTokenKey, { path: AUTH_CONSTANTS.cookies.accessTokenPath });
  }
}
