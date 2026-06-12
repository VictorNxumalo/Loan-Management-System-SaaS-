import { BadRequestException, Injectable } from '@nestjs/common';
import type { BorrowerLendingStatusDto } from '@lms/types';
import { LoanStatus } from '@lms/types';
import { PrismaService, PrismaTx } from '../prisma/prisma.service';

const BLOCKING_LOAN_STATUSES = [
  LoanStatus.DRAFT,
  LoanStatus.ACTIVE,
  LoanStatus.IN_ARREARS,
] as const;

@Injectable()
export class BorrowerLendingConstraintsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(borrowerUserId: string): Promise<BorrowerLendingStatusDto> {
    const commitment = await this.findActiveCommitment(borrowerUserId);

    if (!commitment) {
      return {
        hasActiveCommitment: false,
        committedOrgId: null,
        committedOrgName: null,
        canConnectToOtherLenders: true,
        canApplyWithOtherLenders: true,
        message: null,
      };
    }

    return {
      hasActiveCommitment: true,
      committedOrgId: commitment.orgId,
      committedOrgName: commitment.orgName,
      canConnectToOtherLenders: false,
      canApplyWithOtherLenders: false,
      message: `You have an open loan relationship with ${commitment.orgName}. Finish or settle that loan before connecting with or applying to another lender.`,
    };
  }

  async assertCanEngageWithLender(borrowerUserId: string, targetOrgId: string): Promise<void> {
    const commitment = await this.findActiveCommitment(borrowerUserId);

    if (commitment && commitment.orgId !== targetOrgId) {
      throw new BadRequestException(
        `You already have an open loan with ${commitment.orgName}. Finish that loan before working with another lender.`,
      );
    }
  }

  private async findActiveCommitment(
    borrowerUserId: string,
    tx?: PrismaTx,
  ): Promise<{ orgId: string; orgName: string } | null> {
    const query = async (client: PrismaTx) => {
      const loan = await client.loan.findFirst({
        where: {
          deletedAt: null,
          status: { in: [...BLOCKING_LOAN_STATUSES] },
          borrower: {
            platformUserId: borrowerUserId,
            deletedAt: null,
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          organisation: { select: { id: true, name: true } },
        },
      });

      if (!loan) {
        return null;
      }

      return {
        orgId: loan.organisation.id,
        orgName: loan.organisation.name,
      };
    };

    if (tx) {
      return query(tx);
    }

    return this.prisma.withUserContext(borrowerUserId, null, query);
  }
}
