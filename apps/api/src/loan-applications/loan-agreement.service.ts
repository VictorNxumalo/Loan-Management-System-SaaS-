import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InterestType } from '@lms/types';
import { buildLoanAgreementHtml } from '@lms/utils';
import { formatCents } from '../common/money';
import { getNcrRepoRatePercent } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const INTEREST_LABELS: Record<string, string> = {
  [InterestType.FLAT]: 'Flat rate',
  [InterestType.REDUCING]: 'Reducing balance',
};

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'monthly',
  WEEKLY: 'weekly',
  FORTNIGHTLY: 'fortnightly',
};

@Injectable()
export class LoanAgreementService {
  constructor(private readonly prisma: PrismaService) {}

  async generateForApplication(
    orgId: string,
    userId: string,
    applicationId: string,
    annualRatePercent: number,
  ): Promise<string> {
    if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) {
      throw new BadRequestException('Annual rate must be a non-negative number');
    }

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const application = await tx.loanApplication.findFirst({
        where: { id: applicationId, orgId },
        include: {
          organisation: true,
          borrowerUser: { select: { name: true } },
        },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      return buildLoanAgreementHtml({
        organisationName: application.organisation.name,
        borrowerName: application.borrowerUser.name,
        principalFormatted: formatCents(application.principalCents),
        annualRatePercent,
        interestTypeLabel:
          INTEREST_LABELS[application.interestType] ?? application.interestType,
        termPeriods: application.termPeriods,
        frequencyLabel:
          FREQUENCY_LABELS[application.frequency] ?? application.frequency.toLowerCase(),
        startDate: application.startDate.toISOString().slice(0, 10),
        generatedAt: new Date().toISOString().slice(0, 10),
        repoRatePercent: getNcrRepoRatePercent(),
      });
    });
  }
}
