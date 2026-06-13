import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  MarketplaceLenderDto,
  OrganisationLogoUploadInput,
  OrganisationLogoUploadUrlDto,
  OrganisationSettingsInput,
} from '@lms/types';
import { AccountType, BorrowerLinkSource } from '@lms/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  isPublicListingEnabled,
  mergeMarketplaceProfile,
  parseMarketplaceProfile,
} from '../common/organisation-settings';
import {
  assertLogoPathForOrg,
  assertValidLogoUpload,
  buildOrganisationLogoPath,
  getOrganisationLogoStoragePath,
} from '../common/organisation-logo.util';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { TokenService } from '../auth/token.service';
import { EmailService } from '../email/email.service';
import { BorrowerLendingConstraintsService } from './borrower-lending-constraints.service';

@Injectable()
export class BorrowerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly lendingConstraints: BorrowerLendingConstraintsService,
    private readonly storage: SupabaseStorageService,
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

        const logoStoragePath = getOrganisationLogoStoragePath(org.settings);
        let logoUrl: string | null = null;
        if (logoStoragePath) {
          try {
            logoUrl = await this.storage.createSignedDownloadUrl(logoStoragePath);
          } catch {
            logoUrl = null;
          }
        }

        results.push({
          id: org.id,
          name: org.name,
          plan: org.plan,
          isPublic: isPublicListingEnabled(org.settings),
          isConnected: true,
          logoUrl,
          profile: parseMarketplaceProfile(org.settings),
        });
      }

      return results;
    });
  }

  async connectToPublicLender(userId: string, orgId: string): Promise<{ message: string }> {
    await this.lendingConstraints.assertCanEngageWithLender(userId, orgId);

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

      await this.lendingConstraints.assertCanEngageWithLender(userId, invite.orgId);

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
    private readonly storage: SupabaseStorageService,
  ) {}

  async requestLogoUploadUrl(
    orgId: string,
    userId: string,
    input: OrganisationLogoUploadInput,
  ): Promise<OrganisationLogoUploadUrlDto> {
    assertValidLogoUpload(input.contentType, input.sizeBytes);

    await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      await tx.organisation.findFirstOrThrow({ where: { id: orgId } });
    });

    const storagePath = buildOrganisationLogoPath(orgId, input.filename, input.contentType);
    const signed = await this.storage.createSignedUploadUrl(storagePath);

    return {
      uploadUrl: signed.signedUrl,
      storagePath,
    };
  }

  async updateOrganisationSettings(
    orgId: string,
    userId: string,
    input: OrganisationSettingsInput,
  ) {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });
      const current = (org.settings as Record<string, unknown>) ?? {};

      let nextSettings: Record<string, unknown> = { ...current };

      if (input.publicListing !== undefined) {
        nextSettings.publicListing = input.publicListing;
      }

      if (input.marketplaceProfile) {
        nextSettings = mergeMarketplaceProfile(nextSettings, input.marketplaceProfile);
      }

      if (input.logoStoragePath !== undefined) {
        if (input.logoStoragePath === '') {
          const previousLogo = getOrganisationLogoStoragePath(current);
          delete nextSettings.logoStoragePath;
          if (previousLogo) {
            void this.storage.removeObject(previousLogo);
          }
        } else {
          assertLogoPathForOrg(orgId, input.logoStoragePath);
          const previousLogo = getOrganisationLogoStoragePath(current);
          nextSettings.logoStoragePath = input.logoStoragePath;
          if (previousLogo && previousLogo !== input.logoStoragePath) {
            void this.storage.removeObject(previousLogo);
          }
        }
      }

      const updated = await tx.organisation.update({
        where: { id: orgId },
        data: { settings: nextSettings as Prisma.InputJsonValue },
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
