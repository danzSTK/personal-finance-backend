import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Res,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { type Response } from 'express';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { LogoutDto } from './dto/logout.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayloadDto } from './dto/jwt-payload.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('sign-up')
  async signUp(@Body() signUpDto: RegisterDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  signIn(@CurrentUser() user: User) {
    return this.authService.signIn(user);
  }

  /**
   * 🚀 ROTA 1: Iniciar login com Google
   * GET /auth/google
   *
   * 🧠 FLUXO:
   * 1. GoogleAuthGuard redireciona para Google OAuth
   * 2. Usuário vê tela de consentimento do Google
   * 3. Após autorizar, Google redireciona para /auth/google/callback
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redireciona automaticamente
    // Não precisa implementar nada aqui
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
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@CurrentUser() user: User, @Res() res: Response) {
    // Gerar tokens JWT
    const tokens = await this.authService.signIn(user);

    // Redirecionar para frontend com tokens
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;

    return res.redirect(redirectUrl);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  async refresh(@CurrentUser() user: { id: string; jti: string }) {
    return this.authService.rotateTokens(user.id, user.jti);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @Headers('Authorization') authHeader: string,
    @Body() logoutDto: LogoutDto,
  ) {
    const accessToken = authHeader.replace('Bearer ', '');

    const rtPayload = this.jwtService.decode<JwtPayloadDto>(
      logoutDto.refreshToken,
    );

    return this.authService.logout(user.id, accessToken, rtPayload.jti);
  }
}
