import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MarketplaceLenderDto } from '@lms/types';
import { AccountType, BorrowerLinkSource } from '@lms/types';
import { AuditService } from '../audit/audit.service';
import { isPublicListingEnabled } from '../common/organisation-settings';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class BorrowerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async listMyLenders(userId: string): Promise<MarketplaceLenderDto[]> {
    return this.prisma.withUserContext(userId, null, async (tx) => {
      const links = await tx.borrowerLenderLink.findMany({
        where: { borrowerUserId: userId },
        orderBy: { createdAt: 'desc' },
      });

      if (links.length === 0) {
        return [];
      }

      const orgs = await tx.organisation.findMany({
        where: {
          id: { in: links.map((link) => link.orgId) },
          deletedAt: null,
        },
      });

      const orgById = new Map(orgs.map((org) => [org.id, org]));
      const results: MarketplaceLenderDto[] = [];

      for (const link of links) {
        const org = orgById.get(link.orgId);
        if (!org) {
          continue;
        }

        results.push({
          id: org.id,
          name: org.name,
          plan: org.plan,
          isPublic: isPublicListingEnabled(org.settings),
          isConnected: true,
        });
      }

      return results;
    });
  }

  async connectToPublicLender(userId: string, orgId: string): Promise<{ message: string }> {
    return this.prisma.withUserContext(userId, null, async (tx) => {
      const org = await tx.organisation.findFirst({
        where: { id: orgId, deletedAt: null },
      });

      if (!org) {
        throw new NotFoundException('Lender not found');
      }

      const settings = (org.settings as Record<string, unknown>) ?? {};
      if (!isPublicListingEnabled(settings)) {
        throw new BadRequestException('This lender is not publicly listed');
      }

      await tx.borrowerLenderLink.upsert({
        where: {
          borrowerUserId_orgId: { borrowerUserId: userId, orgId },
        },
        create: {
          borrowerUserId: userId,
          orgId,
          source: BorrowerLinkSource.PUBLIC,
        },
        update: {},
      });

      return { message: 'Connected to lender successfully' };
    });
  }

  async acceptInvite(userId: string, rawToken: string): Promise<{ message: string }> {
    const hash = this.tokenService.hashToken(rawToken);

    return this.prisma.withAuthLookup(async (tx) => {
      const invite = await tx.lenderInvite.findUnique({
        where: { tokenHash: hash },
        include: { organisation: true },
      });

      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        throw new BadRequestException('Invalid or expired invite');
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.accountType !== AccountType.BORROWER) {
        throw new BadRequestException('Borrower account required');
      }

      if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
        throw new BadRequestException('Invite email does not match your account');
      }

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

      return { message: `You are now connected to ${invite.organisation.name}` };
    });
  }
}

@Injectable()
export class LenderSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  async updateOrganisationSettings(
    orgId: string,
    userId: string,
    input: { publicListing?: boolean },
  ) {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });
      const current = (org.settings as Record<string, unknown>) ?? {};

      const updated = await tx.organisation.update({
        where: { id: orgId },
        data: {
          settings: {
            ...current,
            ...(input.publicListing !== undefined
              ? { publicListing: input.publicListing }
              : {}),
          },
        },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'settings.updated',
        entityType: 'ORGANISATION',
        entityId: orgId,
        before: { settings: current },
        after: { settings: (updated.settings as Record<string, unknown>) ?? {} },
      });

      return {
        id: updated.id,
        name: updated.name,
        settings: (updated.settings as Record<string, unknown>) ?? {},
      };
    });
  }

  async sendBorrowerInvite(orgId: string, userId: string, email: string) {
    const normalised = email.toLowerCase();
    const { token, hash } = this.tokenService.generateOpaqueToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const org = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      await tx.lenderInvite.create({
        data: {
          orgId,
          email: normalised,
          tokenHash: hash,
          expiresAt,
        },
      });

      return tx.organisation.findFirstOrThrow({ where: { id: orgId } });
    });

    const link = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/borrower/invites/accept?token=${token}`;
    await this.emailService.sendBorrowerInviteEmail(normalised, org.name, link);

    return { message: `Invite sent to ${normalised}` };
  }
}
