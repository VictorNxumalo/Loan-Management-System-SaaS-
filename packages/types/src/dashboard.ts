export interface DashboardKpisDto {
  activeLoans: number;
  portfolioValueFormatted: string;
  repaymentsThisMonthFormatted: string;
  loansInArrears: number;
  arrearsRatePercent: number;
}

export interface UpcomingRepaymentDto {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  periodNumber: number;
  dueDate: string;
  amountDueFormatted: string;
  loanStatus: string;
}

export interface OverdueLoanDto {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  outstandingBalanceFormatted: string;
  daysOverdue: number;
  oldestOverdueDueDate: string;
  loanStatus: string;
}

export interface DashboardDto {
  kpis: DashboardKpisDto;
  upcoming7Days: UpcomingRepaymentDto[];
  upcoming30Days: UpcomingRepaymentDto[];
  overdueLoans: OverdueLoanDto[];
}

export interface OverdueSweepResultDto {
  organisationsProcessed: number;
  loansChecked: number;
  loansUpdated: number;
}
