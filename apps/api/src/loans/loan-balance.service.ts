import { Injectable } from '@nestjs/common';
import type { LoanStatus } from '@lms/types';
import {
  computeOutstandingBalanceCents,
  isLoanInArrears,
  resolveLoanStatus,
  sumRepaymentCents,
  sumScheduleTotalCents,
} from '@lms/utils';
import type { PrismaTx } from '../prisma/prisma.service';

export interface LoanBalanceSnapshot {
  totalScheduledCents: number;
  totalPaidCents: number;
  outstandingCents: number;
  inArrears: boolean;
  resolvedStatus: LoanStatus;
}

@Injectable()
export class LoanBalanceService {
  computeFromData(
    schedule: { dueDate: Date; totalDueCents: number; periodNumber: number }[],
    repayments: { amountCents: number }[],
    currentStatus: LoanStatus,
    asOf: Date = new Date(),
  ): LoanBalanceSnapshot {
    const totalScheduledCents = sumScheduleTotalCents(schedule);
    const totalPaidCents = sumRepaymentCents(repayments);
    const outstandingCents = computeOutstandingBalanceCents(
      totalScheduledCents,
      totalPaidCents,
    );
    const inArrears = isLoanInArrears(
      schedule,
      totalPaidCents,
      outstandingCents,
      asOf,
    );
    const resolvedStatus = resolveLoanStatus(
      currentStatus,
      outstandingCents,
      inArrears,
    );

    return {
      totalScheduledCents,
      totalPaidCents,
      outstandingCents,
      inArrears,
      resolvedStatus,
    };
  }

  async syncLoanStatus(
    tx: PrismaTx,
    loanId: string,
    currentStatus: LoanStatus,
  ): Promise<LoanStatus> {
    if (currentStatus === 'DRAFT' || currentStatus === 'WRITTEN_OFF') {
      return currentStatus;
    }

    const loan = await tx.loan.findUniqueOrThrow({
      where: { id: loanId },
      include: {
        repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
        repayments: true,
      },
    });

    const snapshot = this.computeFromData(
      loan.repaymentSchedules,
      loan.repayments,
      loan.status,
    );

    if (snapshot.resolvedStatus !== loan.status) {
      await tx.loan.update({
        where: { id: loanId },
        data: { status: snapshot.resolvedStatus },
      });
    }

    return snapshot.resolvedStatus;
  }
}
