import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppConfig } from '../../config/configuration';
import { generateRandomToken, hashToken } from '../../common/utils/crypto.util';
import { PublicUser } from '../users/users.constants';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../integrations/mail/mail.service';
import { IssuedTokens, TokensService } from './tokens.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/password.dto';

interface RequestContext {
  userAgent?: string;
  ip?: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: IssuedTokens;
}

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TTL_MS = 60 * 60 * 1000; // 1h

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get saltRounds(): number {
    return this.config.get('security.bcryptSaltRounds', { infer: true });
  }

  async register(dto: RegisterDto, context: RequestContext): Promise<AuthResult> {
    const existing = await this.users.findByEmailWithSecrets(dto.email);
    if (existing) {
      throw new BadRequestException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone.replace(/\s+/g, ''),
    });

    await this.issueEmailVerification(user.id, user.email);

    const tokens = await this.tokens.issueTokens(
      { id: user.id, email: user.email, role: user.role },
      context,
    );
    return { user, tokens };
  }

  async login(dto: LoginDto, context: RequestContext): Promise<AuthResult> {
    const user = await this.users.findByEmailWithSecrets(dto.email);

    // Uniform error to prevent account enumeration.
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        'Account temporarily locked due to too many failed attempts. Try again later.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.users.registerFailedLogin(
        user,
        this.config.get('security.maxLoginAttempts', { infer: true }),
        this.config.get('security.accountLockMinutes', { infer: true }),
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.users.registerSuccessfulLogin(user.id);

    const tokens = await this.tokens.issueTokens(
      { id: user.id, email: user.email, role: user.role },
      context,
    );
    return { user: await this.users.findPublicById(user.id), tokens };
  }

  async refresh(token: string, context: RequestContext): Promise<IssuedTokens> {
    if (!token) throw new UnauthorizedException('Refresh token missing');
    return this.tokens.rotateRefreshToken(token, context);
  }

  async logout(token?: string): Promise<void> {
    if (token) await this.tokens.revokeRefreshToken(token);
  }

  async logoutEverywhere(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.users.findByEmailWithSecrets(dto.email);
    // Always succeed silently to avoid leaking which emails exist.
    if (!user) return;

    const rawToken = generateRandomToken();
    await this.prisma.token.create({
      data: {
        userId: user.id,
        type: TokenType.PASSWORD_RESET,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    await this.mail.sendPasswordResetEmail(user.email, rawToken);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.consumeToken(dto.token, TokenType.PASSWORD_RESET);
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    await this.users.setPassword(record.userId, passwordHash);
    // Invalidate all existing sessions after a password reset.
    await this.tokens.revokeAllForUser(record.userId);
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const record = await this.consumeToken(dto.token, TokenType.EMAIL_VERIFICATION);
    await this.users.markEmailVerified(record.userId);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.users.findByIdWithSecrets(userId);
    if (!user) throw new UnauthorizedException();
    if (user.emailVerified) throw new BadRequestException('Email already verified');
    await this.issueEmailVerification(user.id, user.email);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findByIdWithSecrets(userId);
    if (!user || !user.passwordHash) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);
    await this.users.setPassword(userId, passwordHash);
    await this.tokens.revokeAllForUser(userId);
  }

  // ── helpers ──

  private async issueEmailVerification(userId: string, email: string): Promise<void> {
    const rawToken = generateRandomToken();
    await this.prisma.token.create({
      data: {
        userId,
        type: TokenType.EMAIL_VERIFICATION,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });
    await this.mail.sendVerificationEmail(email, rawToken);
  }

  private async consumeToken(
    rawToken: string,
    type: TokenType,
  ): Promise<{ id: string; userId: string }> {
    const record = await this.prisma.token.findFirst({
      where: { tokenHash: hashToken(rawToken), type },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    await this.prisma.token.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record;
  }
}
