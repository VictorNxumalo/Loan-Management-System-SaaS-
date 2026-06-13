import { Injectable } from '@nestjs/common';
import type { ListMarketplaceLendersQuery, MarketplaceLenderDto } from '@lms/types';
import { getOrganisationLogoStoragePath } from '../common/organisation-logo.util';
import {
  isPublicListingEnabled,
  parseMarketplaceProfile,
} from '../common/organisation-settings';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async listPublicLenders(
    borrowerUserId?: string,
    query: ListMarketplaceLendersQuery = {},
  ): Promise<MarketplaceLenderDto[]> {
    const orgs = await this.prisma.organisation.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });

    let connectedOrgIds = new Set<string>();
    if (borrowerUserId) {
      const links = await this.prisma.withUserContext(borrowerUserId, null, async (tx) =>
        tx.borrowerLenderLink.findMany({
          where: { borrowerUserId },
          select: { orgId: true },
        }),
      );
      connectedOrgIds = new Set(links.map((link) => link.orgId));
    }

    const lenders = orgs
      .filter((org) => isPublicListingEnabled(org.settings))
      .map((org) => ({
        id: org.id,
        name: org.name,
        plan: org.plan,
        isPublic: true,
        isConnected: connectedOrgIds.has(org.id),
        logoStoragePath: getOrganisationLogoStoragePath(org.settings),
        profile: parseMarketplaceProfile(org.settings),
      }))
      .filter((lender) =>
        query.category ? lender.profile.category === query.category : true,
      );

    const logoUrls = await Promise.all(
      lenders.map((lender) => this.resolveLogoUrl(lender.logoStoragePath)),
    );

    return lenders.map((lender, index) => ({
      id: lender.id,
      name: lender.name,
      plan: lender.plan,
      isPublic: lender.isPublic,
      isConnected: lender.isConnected,
      logoUrl: logoUrls[index] ?? null,
      profile: lender.profile,
    }));
  }

  private async resolveLogoUrl(storagePath: string | null): Promise<string | null> {
    if (!storagePath) {
      return null;
    }

    try {
      return await this.storage.createSignedDownloadUrl(storagePath);
    } catch {
      return null;
    }
  }
}
