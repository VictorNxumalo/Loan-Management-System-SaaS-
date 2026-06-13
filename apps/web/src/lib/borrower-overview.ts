import type {
  BorrowerLoanListItemDto,
  LoanApplicationListItemDto,
} from '@lms/types';
import { LoanApplicationStatus, LoanStatus } from '@lms/types';
import { formatRandDisplay } from '@/lib/money-input';

const ACTIVE_LOAN_STATUSES = new Set<string>([
  LoanStatus.ACTIVE,
  LoanStatus.IN_ARREARS,
  LoanStatus.DRAFT,
]);

const OPEN_APPLICATION_STATUSES = new Set<string>([
  LoanApplicationStatus.DRAFT,
  LoanApplicationStatus.SUBMITTED,
]);

export function aggregateBorrowerLoans(loans: BorrowerLoanListItemDto[]) {
  const activeLoans = loans.filter((loan) => ACTIVE_LOAN_STATUSES.has(loan.status));
  const loansInArrears = loans.filter((loan) => loan.status === LoanStatus.IN_ARREARS);
  const totalOutstandingCents = activeLoans.reduce(
    (sum, loan) => sum + loan.outstandingBalanceCents,
    0,
  );

  return {
    totalLoans: loans.length,
    activeLoans: activeLoans.length,
    loansInArrears: loansInArrears.length,
    totalOutstandingFormatted: formatRandDisplay(totalOutstandingCents) ?? 'R 0.00',
    recentLoans: [...loans]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
  };
}

export function aggregateBorrowerApplications(applications: LoanApplicationListItemDto[]) {
  const openApplications = applications.filter((item) =>
    OPEN_APPLICATION_STATUSES.has(item.status),
  );

  return {
    totalApplications: applications.length,
    openApplications: openApplications.length,
    recentApplications: [...applications]
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, 5),
  };
}
