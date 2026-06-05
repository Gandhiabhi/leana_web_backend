import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppConfig } from '../../config/configuration';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { hashToken } from '../../common/utils/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  /** Issues a new access + refresh pair and persists the refresh token's hash. */
  async issueTokens(user: Pick<User, 'id' | 'email' | 'role'>, context?: { userAgent?: string; ip?: string }, family?: string): Promise<IssuedTokens> {
    const jwtConfig = this.config.get('jwt', { infer: true });
    type Expiry = JwtSignOptions['expiresIn'];

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'access' } satisfies JwtPayload,
      { secret: jwtConfig.accessSecret, expiresIn: jwtConfig.accessExpiresIn as Expiry },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'refresh' } satisfies JwtPayload,
      { secret: jwtConfig.refreshSecret, expiresIn: jwtConfig.refreshExpiresIn as Expiry },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    const refreshExpiresAt = new Date(decoded.exp * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        family: family ?? randomUUID(),
        expiresAt: refreshExpiresAt,
        userAgent: context?.userAgent,
        ip: context?.ip,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: jwtConfig.accessExpiresIn,
      refreshExpiresAt,
    };
  }

  /**
   * Rotates a refresh token. Verifies the JWT, ensures the stored record is
   * active, and detects token reuse — if a revoked token is replayed the whole
   * token family is invalidated (defends against stolen refresh tokens).
   */
  async rotateRefreshToken(
    presentedToken: string,
    context?: { userAgent?: string; ip?: string },
  ): Promise<IssuedTokens> {
    const jwtConfig = this.config.get('jwt', { infer: true });

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(presentedToken, {
        secret: jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenHash = hashToken(presentedToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException('Refresh token not recognised');
    }

    if (stored.revokedAt) {
      // Reuse of an already-rotated token => likely theft. Burn the family.
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ForbiddenException('Refresh token reuse detected — session revoked');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: stored.userId, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('Account is inactive or no longer exists');
    }

    const issued = await this.issueTokens(user, context, stored.family);

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: hashToken(issued.refreshToken) },
    });

    return issued;
  }

  async revokeRefreshToken(presentedToken: string): Promise<void> {
    const tokenHash = hashToken(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
