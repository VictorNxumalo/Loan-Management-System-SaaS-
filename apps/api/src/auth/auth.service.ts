import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthMeResponse,
  AuthTokensResponse,
  ForgotPasswordInput,
  GoogleAuthInput,
  LoginInput,
  OnboardingInput,
  RegisterInput,
  ResetPasswordInput,
} from '@lms/types';
import { UserRole } from '@lms/types';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { EmailService } from '../email/email.service';
import {
  getEnv,
  isEmailVerificationSkipped,
  isGoogleOAuthConfigured,
} from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

const BCRYPT_ROUNDS = 12;
const VERIFICATION_EXPIRY_HOURS = 24;
const RESET_EXPIRY_HOURS = 1;

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
  ) {
    if (isGoogleOAuthConfigured()) {
      const env = getEnv();
      this.googleClient = new OAuth2Client(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
      );
    }
  }

  async register(input: RegisterInput): Promise<{ message: string }> {
    const email = input.email.toLowerCase();

    const existing = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({ where: { email, deletedAt: null } }),
    );
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organisation.create({
        data: {
          name: `${input.name}'s Organisation`,
          settings: {},
        },
      });

      await this.prisma.setSessionContext(tx, { orgId: org.id });

      const created = await tx.user.create({
        data: {
          orgId: org.id,
          email,
          name: input.name,
          role: UserRole.ADMIN,
          passwordHash,
          ...(isEmailVerificationSkipped()
            ? { emailVerifiedAt: new Date() }
            : {}),
        },
        include: { organisation: true },
      });

      if (!isEmailVerificationSkipped()) {
        const { token, hash } = this.tokenService.generateOpaqueToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + VERIFICATION_EXPIRY_HOURS);

        await tx.emailVerificationToken.create({
          data: { userId: created.id, tokenHash: hash, expiresAt },
        });

        await this.emailService.sendVerificationEmail(email, token);
      }

      return created;
    });

    return {
      message: isEmailVerificationSkipped()
        ? `Registration successful. You can sign in now (${user.email}).`
        : `Registration successful. Please verify your email (${user.email}).`,
    };
  }

  async login(input: LoginInput): Promise<{
    tokens: AuthTokensResponse;
    refreshToken: string;
  }> {
    const email = input.email.toLowerCase();

    const user = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({
        where: { email, deletedAt: null, isActive: true },
        include: { organisation: true },
      }),
    );

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerifiedAt) {
      if (isEmailVerificationSkipped()) {
        const verified = await this.prisma.withAuthLookup(async (tx) =>
          tx.user.update({
            where: { id: user.id },
            data: { emailVerifiedAt: new Date() },
            include: { organisation: true },
          }),
        );
        return this.issueTokens(verified);
      }

      throw new UnauthorizedException(
        'Please verify your email before logging in. Check your inbox or the API console in development.',
      );
    }

    return this.issueTokens(user);
  }

  async googleAuth(input: GoogleAuthInput): Promise<{
    tokens: AuthTokensResponse;
    refreshToken: string;
  }> {
    if (!this.googleClient) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const env = getEnv();
    const ticket = await this.googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const email = payload.email.toLowerCase();
    const name = payload.name ?? email.split('@')[0] ?? 'User';
    const googleId = payload.sub;

    let user = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({
        where: {
          OR: [{ googleId }, { email }],
          deletedAt: null,
        },
        include: { organisation: true },
      }),
    );

    if (!user) {
      user = await this.prisma.$transaction(async (tx) => {
        const org = await tx.organisation.create({
          data: { name: `${name}'s Organisation`, settings: {} },
        });

        await this.prisma.setSessionContext(tx, { orgId: org.id });

        return tx.user.create({
          data: {
            orgId: org.id,
            email,
            name,
            role: UserRole.ADMIN,
            googleId,
            emailVerifiedAt: new Date(),
          },
          include: { organisation: true },
        });
      });
    } else if (!user.googleId) {
      user = await this.prisma.withOrgContext(user.orgId, user.id, async (tx) =>
        tx.user.update({
          where: { id: user!.id },
          data: { googleId, emailVerifiedAt: user!.emailVerifiedAt ?? new Date() },
          include: { organisation: true },
        }),
      );
    }

    return this.issueTokens(user);
  }

  async refresh(rawRefreshToken: string): Promise<{
    tokens: AuthTokensResponse;
    refreshToken: string;
  }> {
    const { userId, newRefreshToken } =
      await this.tokenService.rotateRefreshToken(rawRefreshToken);

    const user = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        include: { organisation: true },
      }),
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = this.buildTokenResponse(user);
    return { tokens, refreshToken: newRefreshToken };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) {
      await this.tokenService.revokeRefreshToken(rawRefreshToken);
    }
  }

  async getMe(userId: string, orgId: string): Promise<AuthMeResponse> {
    const user = await this.prisma.withOrgContext(orgId, userId, async (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        include: { organisation: true },
      }),
    );

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.mapMe(user);
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const hash = this.tokenService.hashToken(token);

    await this.prisma.withAuthLookup(async (tx) => {
      const record = await tx.emailVerificationToken.findUnique({
        where: { tokenHash: hash },
        include: { user: true },
      });

      if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new BadRequestException('Invalid or expired verification token');
      }

      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
    });

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
    const email = input.email.toLowerCase();

    const user = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({ where: { email, deletedAt: null } }),
    );

    if (user) {
      const { token, hash } = this.tokenService.generateOpaqueToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + RESET_EXPIRY_HOURS);

      await this.prisma.withAuthLookup(async (tx) => {
        await tx.passwordResetToken.create({
          data: { userId: user.id, tokenHash: hash, expiresAt },
        });
      });

      await this.emailService.sendPasswordResetEmail(email, token);
    }

    return {
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const hash = this.tokenService.hashToken(input.token);
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    await this.prisma.withAuthLookup(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash: hash },
      });

      if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      await this.tokenService.revokeAllUserTokens(record.userId);
    });

    return { message: 'Password reset successfully. You can now log in.' };
  }

  async completeOnboarding(
    userId: string,
    orgId: string,
    input: OnboardingInput,
  ): Promise<AuthMeResponse> {
    const user = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      await tx.organisation.update({
        where: { id: orgId },
        data: {
          name: input.organisationName,
          settings: {
            defaultCurrency: input.defaultCurrency,
            defaultInterestType: input.defaultInterestType,
          },
        },
      });

      return tx.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: new Date() },
        include: { organisation: true },
      });
    });

    return this.mapMe(user);
  }

  private async issueTokens(user: {
    id: string;
    orgId: string;
    email: string;
    name: string;
    role: string;
    emailVerifiedAt: Date | null;
    onboardingCompletedAt: Date | null;
    organisation: {
      id: string;
      name: string;
      plan: string;
      planStatus: string;
      settings: unknown;
    };
  }) {
    const refreshToken = await this.prisma.$transaction(async (tx) => {
      await this.prisma.setSessionContext(tx, {
        userId: user.id,
        orgId: user.orgId,
      });
      return this.tokenService.createRefreshToken(tx, user.id);
    });

    const tokens = await this.buildTokenResponse(user);
    return { tokens, refreshToken };
  }

  private buildTokenResponse(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerifiedAt: Date | null;
    onboardingCompletedAt: Date | null;
    organisation: {
      id: string;
      name: string;
      plan: string;
      planStatus: string;
      settings: unknown;
    };
  }): AuthTokensResponse {
    const { accessToken, expiresIn } = this.tokenService.signAccessToken({
      sub: user.id,
      orgId: user.organisation.id,
      role: user.role,
      email: user.email,
    });

    return {
      accessToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: this.isEmailVerified(user),
        onboardingCompleted: Boolean(user.onboardingCompletedAt),
      },
      organisation: {
        id: user.organisation.id,
        name: user.organisation.name,
        plan: user.organisation.plan,
        planStatus: user.organisation.planStatus,
        settings: (user.organisation.settings as Record<string, unknown>) ?? {},
      },
    };
  }

  private mapMe(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerifiedAt: Date | null;
    onboardingCompletedAt: Date | null;
    organisation: {
      id: string;
      name: string;
      plan: string;
      planStatus: string;
      settings: unknown;
    };
  }): AuthMeResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: this.isEmailVerified(user),
        onboardingCompleted: Boolean(user.onboardingCompletedAt),
      },
      organisation: {
        id: user.organisation.id,
        name: user.organisation.name,
        plan: user.organisation.plan,
        planStatus: user.organisation.planStatus,
        settings: (user.organisation.settings as Record<string, unknown>) ?? {},
      },
    };
  }

  private isEmailVerified(user: { emailVerifiedAt: Date | null }): boolean {
    return Boolean(user.emailVerifiedAt) || isEmailVerificationSkipped();
  }
}
