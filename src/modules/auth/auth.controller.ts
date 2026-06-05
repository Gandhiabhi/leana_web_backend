import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AppConfig } from '../../config/configuration';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AuthService } from './auth.service';
import { IssuedTokens } from './tokens.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/auth-tokens.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/password.dto';
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from './auth.cookies';
import { UsersService } from '../users/users.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get isProduction(): boolean {
    return this.config.get('isProduction', { infer: true });
  }

  private get cookieDomain(): string {
    return this.config.get('cookie.domain', { infer: true });
  }

  private attachRefresh(res: Response, tokens: IssuedTokens) {
    setRefreshCookie(
      res,
      tokens.refreshToken,
      tokens.refreshExpiresAt,
      this.isProduction,
      this.cookieDomain,
    );
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresIn: tokens.accessExpiresIn,
    };
  }

  private extractRefresh(req: Request, fromBody?: string): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return fromBody || cookies?.[REFRESH_COOKIE_NAME];
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @ResponseMessage('Account created')
  @ApiOperation({ summary: 'Register a new customer account' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { user: result.user, ...this.attachRefresh(res, result.tokens) };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged in')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { user: result.user, ...this.attachRefresh(res, result.tokens) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Token refreshed')
  @ApiOperation({ summary: 'Exchange a refresh token for a new access/refresh pair' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.extractRefresh(req, dto.refreshToken);
    const tokens = await this.authService.refresh(token ?? '', {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return this.attachRefresh(res, tokens);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out')
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(this.extractRefresh(req));
    clearRefreshCookie(res, this.isProduction, this.cookieDomain);
    return { success: true };
  }

  @Post('logout-all')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('All sessions revoked')
  @ApiOperation({ summary: 'Revoke every active session for the current user' })
  async logoutAll(@CurrentUser('id') userId: string, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutEverywhere(userId);
    clearRefreshCookie(res, this.isProduction, this.cookieDomain);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('If the email exists, a reset link has been sent')
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password updated')
  @ApiOperation({ summary: 'Reset password using a reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { success: true };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email verified')
  @ApiOperation({ summary: 'Verify an email address using a verification token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto);
    return { success: true };
  }

  @Post('resend-verification')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Verification email sent')
  @ApiOperation({ summary: 'Resend the email verification link' })
  async resendVerification(@CurrentUser('id') userId: string) {
    await this.authService.resendVerification(userId);
    return { success: true };
  }

  @Post('change-password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password changed')
  @ApiOperation({ summary: 'Change password for the authenticated user' })
  async changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(userId, dto);
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  me(@CurrentUser('id') userId: string) {
    return this.usersService.findPublicById(userId);
  }
}
