import { InterestType, LoanStatus, RepaymentFrequency } from '@lms/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoanBalanceService } from './loan-balance.service';
import { LoansScheduleService } from './loans-schedule.service';
import { LoansService } from './loans.service';

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)('LoansService integration', () => {
  const prisma = new PrismaService();
  const scheduleService = new LoansScheduleService(prisma);
  const balanceService = new LoanBalanceService();
  const billingService = {
    assertActiveLoanCapacity: async () => {},
  } as unknown as BillingService;
  const loansService = new LoansService(
    prisma,
    scheduleService,
    balanceService,
    new AuditService(prisma),
    billingService,
  );

  let orgId = '';
  let userId = '';
  let borrowerId = '';
  let loanId = '';

  beforeAll(async () => {
    await prisma.$connect();

    const org = await prisma.organisation.create({
      data: { name: 'Phase 3 Loans Integration Org', settings: {} },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        orgId,
        email: `phase3-loans-${Date.now()}@example.com`,
        name: 'Phase 3 Loan Tester',
        role: 'ADMIN',
        passwordHash: 'hash',
        emailVerifiedAt: new Date(),
        onboardingCompletedAt: new Date(),
      },
    });
    userId = user.id;

    const borrower = await prisma.borrower.create({
      data: {
        orgId,
        fullName: 'Integration Borrower',
        idNumber: `ID${Date.now()}`,
        phone: '0800000000',
      },
    });
    borrowerId = borrower.id;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.auditLog.deleteMany({ where: { orgId } });
    }
    if (loanId) {
      await prisma.repayment.deleteMany({ where: { loanId } });
      await prisma.repaymentSchedule.deleteMany({ where: { loanId } });
      await prisma.loan.deleteMany({ where: { id: loanId } });
    }
    if (borrowerId) {
      await prisma.borrower.deleteMany({ where: { id: borrowerId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    if (orgId) {
      await prisma.organisation.deleteMany({ where: { id: orgId } });
    }
    await prisma.$disconnect();
  });

  it(
    'creates, activates, records repayment, and updates outstanding balance',
    async () => {
    const created = await loansService.create(orgId, userId, {
      borrowerId,
      principalCents: 100_000,
      annualRate: 0,
      interestType: InterestType.FLAT,
      termPeriods: 2,
      frequency: RepaymentFrequency.MONTHLY,
      startDate: new Date('2025-01-01'),
    });

    loanId = created.id;
    expect(created.status).toBe(LoanStatus.DRAFT);
    expect(created.schedule).toHaveLength(2);

    const activated = await loansService.activate(orgId, userId, loanId);
    expect([LoanStatus.ACTIVE, LoanStatus.IN_ARREARS]).toContain(activated.status);

    const repayment = await loansService.recordRepayment(orgId, userId, loanId, {
      amountCents: 50_000,
      paymentDate: new Date('2025-01-15'),
    });

    expect(repayment.repayment.amountCents).toBe(50_000);
    expect(repayment.loan.outstandingBalanceFormatted).toMatch(/R/);

    const detail = await loansService.getById(orgId, userId, loanId);
    expect(detail.totalPaidFormatted).toMatch(/R/);
    expect(detail.outstandingBalanceFormatted).toMatch(/R/);
    },
    30_000,
  );
});
