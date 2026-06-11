import { AccountType, BorrowerLinkSource, InterestType, RepaymentFrequency } from '@lms/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { BorrowerLoansService } from '../borrower-loans/borrower-loans.service';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { LoansScheduleService } from '../loans/loans-schedule.service';
import { LoansService } from '../loans/loans.service';
import { PrismaService } from '../prisma/prisma.service';

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)('Borrower loans integration', () => {
  const prisma = new PrismaService();
  const scheduleService = new LoansScheduleService(prisma);
  const balanceService = new LoanBalanceService();
  const loansService = new LoansService(
    prisma,
    scheduleService,
    balanceService,
    new AuditService(prisma),
  );
  const borrowerLoansService = new BorrowerLoansService(prisma, balanceService);

  let orgId = '';
  let lenderUserId = '';
  let borrowerUserAId = '';
  let borrowerUserBId = '';
  let crmBorrowerAId = '';
  let loanAId = '';

  beforeAll(async () => {
    await prisma.$connect();

    const org = await prisma.organisation.create({
      data: { name: 'Borrower Loans Test Org', settings: {} },
    });
    orgId = org.id;

    const lender = await prisma.user.create({
      data: {
        orgId,
        email: `borrower-loans-lender-${Date.now()}@example.com`,
        name: 'Test Lender',
        role: 'ADMIN',
        passwordHash: 'hash',
        emailVerifiedAt: new Date(),
      },
    });
    lenderUserId = lender.id;

    const borrowerA = await prisma.user.create({
      data: {
        accountType: AccountType.BORROWER,
        email: `borrower-loans-a-${Date.now()}@example.com`,
        name: 'Borrower A',
        passwordHash: 'hash',
        emailVerifiedAt: new Date(),
        onboardingCompletedAt: new Date(),
      },
    });
    borrowerUserAId = borrowerA.id;

    const borrowerB = await prisma.user.create({
      data: {
        accountType: AccountType.BORROWER,
        email: `borrower-loans-b-${Date.now()}@example.com`,
        name: 'Borrower B',
        passwordHash: 'hash',
        emailVerifiedAt: new Date(),
        onboardingCompletedAt: new Date(),
      },
    });
    borrowerUserBId = borrowerB.id;

    await prisma.borrowerLenderLink.createMany({
      data: [
        {
          borrowerUserId: borrowerUserAId,
          orgId,
          source: BorrowerLinkSource.PUBLIC,
        },
        {
          borrowerUserId: borrowerUserBId,
          orgId,
          source: BorrowerLinkSource.PUBLIC,
        },
      ],
    });

    const crmBorrowerA = await prisma.borrower.create({
      data: {
        orgId,
        platformUserId: borrowerUserAId,
        fullName: 'Borrower A CRM',
        idNumber: `BLA${Date.now()}`,
        phone: '0800000101',
      },
    });
    crmBorrowerAId = crmBorrowerA.id;

    const loan = await loansService.create(orgId, lenderUserId, {
      borrowerId: crmBorrowerAId,
      principalCents: 100_000,
      annualRate: 12,
      interestType: InterestType.FLAT,
      termPeriods: 3,
      frequency: RepaymentFrequency.MONTHLY,
      startDate: new Date('2025-01-01'),
    });
    loanAId = loan.id;
  }, 60_000);

  afterAll(async () => {
    if (orgId) {
      await prisma.auditLog.deleteMany({ where: { orgId } });
    }
    if (loanAId) {
      await prisma.repayment.deleteMany({ where: { loanId: loanAId } });
      await prisma.repaymentSchedule.deleteMany({ where: { loanId: loanAId } });
      await prisma.loan.deleteMany({ where: { id: loanAId } });
    }
    if (crmBorrowerAId) {
      await prisma.borrower.deleteMany({ where: { id: crmBorrowerAId } });
    }
    await prisma.borrowerLenderLink.deleteMany({
      where: { borrowerUserId: { in: [borrowerUserAId, borrowerUserBId] } },
    });
    if (borrowerUserAId) {
      await prisma.user.deleteMany({ where: { id: borrowerUserAId } });
    }
    if (borrowerUserBId) {
      await prisma.user.deleteMany({ where: { id: borrowerUserBId } });
    }
    if (lenderUserId) {
      await prisma.user.deleteMany({ where: { id: lenderUserId } });
    }
    if (orgId) {
      await prisma.organisation.deleteMany({ where: { id: orgId } });
    }
    await prisma.$disconnect();
  });

  it('borrower A sees their linked loan in the list', async () => {
    const result = await borrowerLoansService.list(borrowerUserAId, {
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(loanAId);
    expect(result.items[0]?.statusLabel).toBe('Pending activation');
  }, 30_000);

  it('borrower B cannot see borrower A loan in the list', async () => {
    const result = await borrowerLoansService.list(borrowerUserBId, {
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  }, 30_000);

  it('borrower A can read their loan detail', async () => {
    const loan = await borrowerLoansService.getById(borrowerUserAId, loanAId);
    expect(loan.id).toBe(loanAId);
    expect(loan.organisationName).toBe('Borrower Loans Test Org');
    expect(loan.schedule.length).toBeGreaterThan(0);
  }, 30_000);

  it('borrower A can read an activated loan detail', async () => {
    const activated = await loansService.activate(orgId, lenderUserId, loanAId);
    expect(activated.status).toMatch(/ACTIVE|IN_ARREARS/);

    const loan = await borrowerLoansService.getById(borrowerUserAId, loanAId);
    expect(loan.id).toBe(loanAId);
    expect(loan.schedule.length).toBeGreaterThan(0);
    expect(loan.status).toMatch(/ACTIVE|IN_ARREARS|PAID_OFF/);
  }, 30_000);

  it('borrower B cannot read borrower A loan by id', async () => {
    await expect(
      borrowerLoansService.getById(borrowerUserBId, loanAId),
    ).rejects.toThrow('Loan not found');
  }, 30_000);
});
