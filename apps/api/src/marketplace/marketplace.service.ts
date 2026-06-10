import { Injectable } from '@nestjs/common';
import type { MarketplaceLenderDto } from '@lms/types';
import { isPublicListingEnabled } from '../common/organisation-settings';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicLenders(borrowerUserId?: string): Promise<MarketplaceLenderDto[]> {
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

    return orgs
      .filter((org) => isPublicListingEnabled(org.settings))
      .map((org) => ({
        id: org.id,
        name: org.name,
        plan: org.plan,
        isPublic: true,
        isConnected: connectedOrgIds.has(org.id),
      }));
  }
}
