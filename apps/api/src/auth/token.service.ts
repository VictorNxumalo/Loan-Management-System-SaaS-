import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS } from '@lms/types';
import { createHash, randomBytes } from 'crypto';
import { getEnv } from '../config/env';
import { PrismaService, PrismaTx } from '../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string;
  accountType: string;
  orgId?: string;
  role?: string;
  email: string;
}

const ACCESS_TOKEN_EXPIRY = `${ACCESS_TOKEN_TTL_SECONDS / 3600}h` as const;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): { accessToken: string; expiresIn: number } {
    const accessToken = this.jwtService.sign(payload, {
      secret: getEnv().JWT_SECRET,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
    return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return this.jwtService.verify<AccessTokenPayload>(token, {
        secret: getEnv().JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  generateOpaqueToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('hex');
    return { token, hash: this.hashToken(token) };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createRefreshToken(tx: PrismaTx, userId: string): Promise<string> {
    const { token, hash } = this.generateOpaqueToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await tx.refreshToken.create({
      data: { userId, tokenHash: hash, expiresAt },
    });

    return token;
  }

  async rotateRefreshToken(
    rawToken: string,
  ): Promise<{ userId: string; newRefreshToken: string }> {
    const hash = this.hashToken(rawToken);

    return this.prisma.withAuthLookup(async (tx) => {
      const existing = await tx.refreshToken.findUnique({
        where: { tokenHash: hash },
        include: { user: true },
      });

      if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
        if (existing?.revokedAt) {
          await tx.refreshToken.updateMany({
            where: { userId: existing.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        throw new UnauthorizedException('Invalid refresh token');
      }

      const { token: newToken, hash: newHash } = this.generateOpaqueToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

      const newRecord = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: newHash,
          expiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByTokenId: newRecord.id },
      });

      return { userId: existing.userId, newRefreshToken: newToken };
    });
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const hash = this.hashToken(rawToken);
    await this.prisma.withAuthLookup(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
