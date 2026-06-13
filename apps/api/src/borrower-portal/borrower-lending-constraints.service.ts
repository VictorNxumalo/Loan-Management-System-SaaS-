import { BadRequestException, Injectable } from '@nestjs/common';
import type { BorrowerLendingStatusDto } from '@lms/types';
import { LoanApplicationStatus, LoanStatus } from '@lms/types';
import { PrismaService, PrismaTx } from '../prisma/prisma.service';

const BLOCKING_LOAN_STATUSES = [
  LoanStatus.DRAFT,
  LoanStatus.ACTIVE,
  LoanStatus.IN_ARREARS,
] as const;

const BLOCKING_APPLICATION_STATUSES = [
  LoanApplicationStatus.DRAFT,
  LoanApplicationStatus.SUBMITTED,
] as const;

type Commitment = {
  orgId: string;
  orgName: string;
  kind: 'loan' | 'application';
  applicationStatus?: LoanApplicationStatus;
};

@Injectable()
export class BorrowerLendingConstraintsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(borrowerUserId: string): Promise<BorrowerLendingStatusDto> {
    const [commitment, blockingLoan] = await Promise.all([
      this.findActiveCommitment(borrowerUserId),
      this.findBlockingLoan(borrowerUserId),
    ]);

    if (!commitment) {
      return {
        hasActiveCommitment: false,
        committedOrgId: null,
        committedOrgName: null,
        canConnectToOtherLenders: true,
        canApplyWithOtherLenders: true,
        canStartNewApplication: true,
        canSubmitDraftApplication: true,
        message: null,
      };
    }

    const message = this.buildCommitmentMessage(commitment);

    return {
      hasActiveCommitment: true,
      committedOrgId: commitment.orgId,
      committedOrgName: commitment.orgName,
      canConnectToOtherLenders: false,
      canApplyWithOtherLenders: false,
      canStartNewApplication: false,
      canSubmitDraftApplication: !blockingLoan,
      message,
    };
  }

  async assertCanEngageWithLender(borrowerUserId: string, targetOrgId: string): Promise<void> {
    const commitment = await this.findActiveCommitment(borrowerUserId);

    if (commitment && commitment.orgId !== targetOrgId) {
      throw new BadRequestException(this.buildCrossLenderMessage(commitment));
    }
  }

  /** Block starting a new application while an open loan or other open application exists. */
  async assertCanApplyForLoan(borrowerUserId: string, targetOrgId: string): Promise<void> {
    await this.assertNoBlockingLoan(borrowerUserId);
    await this.assertCanEngageWithLender(borrowerUserId, targetOrgId);
  }

  /** Block submitting a saved draft while the borrower has an open loan. */
  async assertCanSubmitDraftApplication(borrowerUserId: string): Promise<void> {
    await this.assertNoBlockingLoan(borrowerUserId);
  }

  private async assertNoBlockingLoan(borrowerUserId: string): Promise<void> {
    const loan = await this.findBlockingLoan(borrowerUserId);

    if (loan) {
      throw new BadRequestException(
        `You have an open loan with ${loan.orgName}. Settle or complete that loan before applying for another.`,
      );
    }
  }

  private buildCommitmentMessage(commitment: Commitment): string {
    if (commitment.kind === 'loan') {
      return `You have an open loan with ${commitment.orgName}. Settle or complete that loan before applying for another.`;
    }

    if (commitment.applicationStatus === LoanApplicationStatus.DRAFT) {
      return `You have a draft application with ${commitment.orgName}. Continue that application or discard it before starting another.`;
    }

    return `You have a pending application with ${commitment.orgName}. Wait for a decision before applying elsewhere.`;
  }

  private buildCrossLenderMessage(commitment: Commitment): string {
    if (commitment.kind === 'loan') {
      return `You already have an open loan with ${commitment.orgName}. Finish that loan before working with another lender.`;
    }

    if (commitment.applicationStatus === LoanApplicationStatus.DRAFT) {
      return `You already have a draft application with ${commitment.orgName}. Continue or discard it before working with another lender.`;
    }

    return `You already have a pending application with ${commitment.orgName}. Wait for a decision before working with another lender.`;
  }

  private async findBlockingLoan(
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

  private async findActiveCommitment(
    borrowerUserId: string,
    tx?: PrismaTx,
  ): Promise<Commitment | null> {
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

      if (loan) {
        return {
          orgId: loan.organisation.id,
          orgName: loan.organisation.name,
          kind: 'loan' as const,
        };
      }

      const application = await client.loanApplication.findFirst({
        where: {
          status: { in: [...BLOCKING_APPLICATION_STATUSES] },
          borrowerUserId,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          organisation: { select: { id: true, name: true } },
        },
      });

      if (!application) {
        return null;
      }

      return {
        orgId: application.organisation.id,
        orgName: application.organisation.name,
        kind: 'application' as const,
        applicationStatus: application.status as LoanApplicationStatus,
      };
    };

    if (tx) {
      return query(tx);
    }

    return this.prisma.withUserContext(borrowerUserId, null, query);
  }
}
