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
import { AccountType, BorrowerLinkSource, UserRole } from '@lms/types';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { EmailService } from '../email/email.service';
import {
  getEnv,
  isEmailVerificationSkipped,
  isGoogleOAuthConfigured,
} from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService, type AccessTokenPayload } from './token.service';

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
    if (input.accountType === AccountType.BORROWER) {
      return this.registerBorrower(input);
    }

    return this.registerLender(input);
  }

  private async registerLender(input: RegisterInput): Promise<{ message: string }> {
    if (input.inviteToken) {
      return this.registerTeamMember(input);
    }

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
          settings: { publicListing: true },
        },
      });

      await this.prisma.setSessionContext(tx, { orgId: org.id });

      const created = await tx.user.create({
        data: {
          accountType: AccountType.LENDER,
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

  /** Register a new staff account into an existing organisation via team invite. */
  private async registerTeamMember(input: RegisterInput): Promise<{ message: string }> {
    const email = input.email.toLowerCase();
    const tokenHash = this.tokenService.hashToken(input.inviteToken!);

    const existing = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({ where: { email, deletedAt: null } }),
    );
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const { user, orgName } = await this.prisma.withAuthLookup(async (tx) => {
      const invite = await tx.teamInvite.findUnique({
        where: { tokenHash },
        include: { organisation: true },
      });

      if (
        !invite ||
        invite.acceptedAt ||
        invite.revokedAt ||
        invite.expiresAt < new Date()
      ) {
        throw new BadRequestException('Invalid or expired team invite');
      }

      if (invite.email.toLowerCase() !== email) {
        throw new BadRequestException(
          'This invite was sent to a different email address',
        );
      }

      const created = await tx.user.create({
        data: {
          accountType: AccountType.LENDER,
          orgId: invite.orgId,
          email,
          name: input.name,
          role: invite.role,
          passwordHash,
          // Org already onboarded — staff skip the onboarding wizard.
          onboardingCompletedAt: new Date(),
          ...(isEmailVerificationSkipped()
            ? { emailVerifiedAt: new Date() }
            : {}),
        },
      });

      // Switch to org+user context so invite update, audit insert, and
      // verification token insert pass their RLS policies.
      await this.prisma.setSessionContext(tx, {
        orgId: invite.orgId,
        userId: created.id,
      });

      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          orgId: invite.orgId,
          userId: created.id,
          action: 'team.member_joined',
          entityType: 'USER',
          entityId: created.id,
          afterState: { name: created.name, email, role: invite.role },
        },
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

      return { user: created, orgName: invite.organisation.name };
    });

    return {
      message: isEmailVerificationSkipped()
        ? `You've joined ${orgName}. You can sign in now (${user.email}).`
        : `You've joined ${orgName}. Please verify your email (${user.email}).`,
    };
  }

  private async registerBorrower(input: RegisterInput): Promise<{ message: string }> {
    const email = input.email.toLowerCase();

    const existing = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({ where: { email, deletedAt: null } }),
    );
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          accountType: AccountType.BORROWER,
          email,
          name: input.name,
          role: null,
          passwordHash,
          ...(isEmailVerificationSkipped()
            ? { emailVerifiedAt: new Date() }
            : {}),
        },
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

    await this.acceptPendingInvitesForEmail(user.id, email);

    return {
      message: isEmailVerificationSkipped()
        ? `Borrower account created. You can sign in now (${user.email}).`
        : `Borrower account created. Please verify your email (${user.email}).`,
    };
  }

  private async acceptPendingInvitesForEmail(userId: string, email: string) {
    await this.prisma.withAuthLookup(async (tx) => {
      const invites = await tx.lenderInvite.findMany({
        where: {
          email: email.toLowerCase(),
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      for (const invite of invites) {
        await tx.lenderInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });

        await tx.borrowerLenderLink.upsert({
          where: {
            borrowerUserId_orgId: { borrowerUserId: userId, orgId: invite.orgId },
          },
          create: {
            borrowerUserId: userId,
            orgId: invite.orgId,
            source: BorrowerLinkSource.INVITE,
          },
          update: {},
        });
      }
    });
  }

  async login(input: LoginInput): Promise<{
    tokens: AuthTokensResponse;
    refreshToken: string;
  }> {
    const email = input.email.toLowerCase();

    const user = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({
        where: { email, deletedAt: null, isActive: true },
        include: { organisation: true, borrowerAccount: true },
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
          data: { name: `${name}'s Organisation`, settings: { publicListing: true } },
        });

        await this.prisma.setSessionContext(tx, { orgId: org.id });

        return tx.user.create({
          data: {
            accountType: AccountType.LENDER,
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
      if (!user.orgId) {
        throw new BadRequestException('Google sign-in is only available for lender accounts');
      }

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
        include: { organisation: true, borrowerAccount: true },
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

  async getMe(user: AccessTokenPayload): Promise<AuthMeResponse> {
    if (user.accountType === AccountType.BORROWER) {
      const record = await this.prisma.withUserContext(user.sub, null, async (tx) =>
        tx.user.findUnique({
          where: { id: user.sub },
          include: { borrowerAccount: true },
        }),
      );

      if (!record) {
        throw new UnauthorizedException('User not found');
      }

      return this.mapMe(record);
    }

    const record = await this.prisma.withOrgContext(user.orgId!, user.sub, async (tx) =>
      tx.user.findUnique({
        where: { id: user.sub },
        include: { organisation: true },
      }),
    );

    if (!record) {
      throw new UnauthorizedException('User not found');
    }

    return this.mapMe(record);
  }

  async completeBorrowerOnboarding(
    userId: string,
    input: { phone: string; idNumber?: string },
  ): Promise<AuthMeResponse> {
    const user = await this.prisma.withUserContext(userId, null, async (tx) => {
      await tx.borrowerAccount.upsert({
        where: { userId },
        create: {
          userId,
          phone: input.phone.trim(),
          idNumber: input.idNumber?.trim() || null,
        },
        update: {
          phone: input.phone.trim(),
          idNumber: input.idNumber?.trim() || null,
        },
      });

      return tx.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: new Date() },
        include: { borrowerAccount: true },
      });
    });

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
      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });
      const current = (org.settings as Record<string, unknown>) ?? {};

      await tx.organisation.update({
        where: { id: orgId },
        data: {
          name: input.organisationName,
          settings: {
            ...current,
            defaultCurrency: input.defaultCurrency,
            defaultInterestType: input.defaultInterestType,
            publicListing: current.publicListing ?? true,
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
    orgId: string | null;
    email: string;
    name: string;
    accountType: string;
    role: string | null;
    emailVerifiedAt: Date | null;
    onboardingCompletedAt: Date | null;
    organisation?: {
      id: string;
      name: string;
      plan: string;
      planStatus: string;
      settings: unknown;
    } | null;
    borrowerAccount?: {
      phone: string;
      idNumber: string | null;
    } | null;
  }) {
    const refreshToken = await this.prisma.$transaction(async (tx) => {
      await this.prisma.setSessionContext(tx, {
        userId: user.id,
        ...(user.orgId ? { orgId: user.orgId } : {}),
      });
      return this.tokenService.createRefreshToken(tx, user.id);
    });

    const tokens = this.buildTokenResponse(user);
    return { tokens, refreshToken };
  }

  private buildTokenResponse(user: {
    id: string;
    email: string;
    name: string;
    accountType: string;
    role: string | null;
    emailVerifiedAt: Date | null;
    onboardingCompletedAt: Date | null;
    organisation?: {
      id: string;
      name: string;
      plan: string;
      planStatus: string;
      settings: unknown;
    } | null;
    borrowerAccount?: {
      phone: string;
      idNumber: string | null;
    } | null;
  }): AuthTokensResponse {
    const { accessToken, expiresIn } = this.tokenService.signAccessToken({
      sub: user.id,
      accountType: user.accountType,
      ...(user.organisation ? { orgId: user.organisation.id } : {}),
      ...(user.role ? { role: user.role } : {}),
      email: user.email,
    });

    return {
      accessToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        role: user.role,
        emailVerified: this.isEmailVerified(user),
        onboardingCompleted: Boolean(user.onboardingCompletedAt),
      },
      ...(user.organisation
        ? {
            organisation: {
              id: user.organisation.id,
              name: user.organisation.name,
              plan: user.organisation.plan,
              planStatus: user.organisation.planStatus,
              settings: (user.organisation.settings as Record<string, unknown>) ?? {},
            },
          }
        : {}),
      ...(user.borrowerAccount
        ? {
            borrowerProfile: {
              phone: user.borrowerAccount.phone,
              idNumber: user.borrowerAccount.idNumber,
            },
          }
        : {}),
    };
  }

  private mapMe(user: {
    id: string;
    email: string;
    name: string;
    accountType: string;
    role: string | null;
    emailVerifiedAt: Date | null;
    onboardingCompletedAt: Date | null;
    organisation?: {
      id: string;
      name: string;
      plan: string;
      planStatus: string;
      settings: unknown;
    } | null;
    borrowerAccount?: {
      phone: string;
      idNumber: string | null;
    } | null;
  }): AuthMeResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        role: user.role,
        emailVerified: this.isEmailVerified(user),
        onboardingCompleted: Boolean(user.onboardingCompletedAt),
      },
      ...(user.organisation
        ? {
            organisation: {
              id: user.organisation.id,
              name: user.organisation.name,
              plan: user.organisation.plan,
              planStatus: user.organisation.planStatus,
              settings: (user.organisation.settings as Record<string, unknown>) ?? {},
            },
          }
        : {}),
      ...(user.borrowerAccount
        ? {
            borrowerProfile: {
              phone: user.borrowerAccount.phone,
              idNumber: user.borrowerAccount.idNumber,
            },
          }
        : {}),
    };
  }

  private isEmailVerified(user: { emailVerifiedAt: Date | null }): boolean {
    return Boolean(user.emailVerifiedAt) || isEmailVerificationSkipped();
  }
}
