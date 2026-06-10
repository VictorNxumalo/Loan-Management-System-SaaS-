import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import {
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  onboardingSchema,
  registerSchema,
  resetPasswordSchema,
} from '@lms/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AccessTokenPayload } from './token.service';
import { getEnv } from '../config/env';

@Controller('auth')
@Throttle({ default: { limit: 100, ttl: 60000 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: Parameters<AuthService['register']>[0],
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: Parameters<AuthService['login']>[0],
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, refreshToken } = await this.authService.login(body);
    this.setRefreshCookie(res, refreshToken);
    return { ...tokens, refreshToken };
  }

  @Post('google')
  async googleAuth(
    @Body(new ZodValidationPipe(googleAuthSchema)) body: Parameters<AuthService['googleAuth']>[0],
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, refreshToken } = await this.authService.googleAuth(body);
    this.setRefreshCookie(res, refreshToken);
    return { ...tokens, refreshToken };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ) {
    const rawToken =
      (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined) ??
      body?.refreshToken;
    if (!rawToken) {
      return { error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token missing' } };
    }

    const { tokens, refreshToken } = await this.authService.refresh(rawToken);
    this.setRefreshCookie(res, refreshToken);
    return { ...tokens, refreshToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.authService.logout(rawToken);
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions());
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.getMe(user.sub, user.orgId);
  }

  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    if (!token) {
      return { error: { code: 'MISSING_TOKEN', message: 'Verification token is required' } };
    }
    return this.authService.verifyEmail(token);
  }

  @Post('forgot-password')
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema))
    body: Parameters<AuthService['forgotPassword']>[0],
  ) {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema))
    body: Parameters<AuthService['resetPassword']>[0],
  ) {
    return this.authService.resetPassword(body);
  }

  @Patch('onboarding')
  @UseGuards(JwtAuthGuard)
  completeOnboarding(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(onboardingSchema))
    body: Parameters<AuthService['completeOnboarding']>[2],
  ) {
    return this.authService.completeOnboarding(user.sub, user.orgId, body);
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_TOKEN_COOKIE, token, this.cookieOptions());
  }

  private cookieOptions() {
    const isProd = getEnv().NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict' as const,
      path: '/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };
  }
}
