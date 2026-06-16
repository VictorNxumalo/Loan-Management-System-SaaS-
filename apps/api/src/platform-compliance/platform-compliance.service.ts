import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  PlatformLenderComplianceDto,
  PlatformVerificationReviewInput,
} from '@lms/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  isPublicListingEnabled,
  parseLenderComplianceProfile,
  parseMarketplaceProfile,
} from '../common/organisation-settings';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listLenders(): Promise<PlatformLenderComplianceDto[]> {
    const orgs = await this.prisma.organisation.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return orgs.map((org) => this.mapOrg(org));
  }

  async reviewVerification(
    orgId: string,
    reviewerEmail: string,
    reviewerUserId: string,
    input: PlatformVerificationReviewInput,
  ): Promise<PlatformLenderComplianceDto> {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organisation.findFirst({
        where: { id: orgId, deletedAt: null },
      });

      if (!org) {
        throw new NotFoundException('Organisation not found');
      }

      const current = (org.settings as Record<string, unknown>) ?? {};
      const profile =
        current.marketplaceProfile && typeof current.marketplaceProfile === 'object'
          ? { ...(current.marketplaceProfile as Record<string, unknown>) }
          : {};

      const reviewedAt = new Date().toISOString();
      profile.verificationStatus = input.verificationStatus;
      profile.verificationReviewedAt = reviewedAt;
      profile.verificationReviewedByEmail = reviewerEmail.trim().toLowerCase();
      if (input.verificationNotes?.trim()) {
        profile.verificationNotes = input.verificationNotes.trim();
      } else {
        delete profile.verificationNotes;
      }

      const nextSettings = {
        ...current,
        marketplaceProfile: profile,
      };

      const updated = await tx.organisation.update({
        where: { id: orgId },
        data: { settings: nextSettings as Prisma.InputJsonValue },
      });

      await this.auditService.record(tx, {
        orgId,
        userId: reviewerUserId,
        action: 'platform.lender_verification_reviewed',
        entityType: 'ORGANISATION',
        entityId: orgId,
        after: {
          verificationStatus: input.verificationStatus,
          verificationReviewedAt: reviewedAt,
          verificationReviewedByEmail: reviewerEmail,
          verificationNotes: input.verificationNotes?.trim() || null,
        },
      });

      return this.mapOrg(updated);
    });
  }

  private mapOrg(org: {
    id: string;
    name: string;
    settings: unknown;
  }): PlatformLenderComplianceDto {
    const settings = (org.settings as Record<string, unknown>) ?? {};
    const marketplace = parseMarketplaceProfile(settings);
    const compliance = parseLenderComplianceProfile(settings);

    return {
      orgId: org.id,
      organisationName: org.name,
      isPublic: isPublicListingEnabled(settings),
      legalEntityName: compliance.legalEntityName,
      ncrRegistrationNumber: compliance.ncrRegistrationNumber,
      complianceContactEmail: compliance.complianceContactEmail,
      verificationStatus: marketplace.verificationStatus,
      verificationLabel: marketplace.verificationLabel,
      verificationReviewedAt: marketplace.verificationReviewedAt,
      verificationReviewedByEmail: compliance.verificationReviewedByEmail,
      verificationNotes: compliance.verificationNotes,
    };
  }
}
