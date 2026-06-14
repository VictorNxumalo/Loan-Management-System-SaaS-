import { InterestType, RepaymentFrequency } from '@lms/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { BorrowersService } from '../borrowers/borrowers.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { LoansScheduleService } from '../loans/loans-schedule.service';
import { LoansService } from '../loans/loans.service';
import { LoanAgreementService } from '../loans/loan-agreement.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { WalletsService } from '../wallets/wallets.service';
import { StitchLoanDisbursementService } from '../stitch/stitch-loan-disbursement.service';

const runIntegration = Boolean(process.env.DATABASE_URL);

const stitchLoanDisbursementMock = {
  isEnabled: () => false,
  mapDto: () => null,
  initiateLoanDisbursement: async () => {},
} as unknown as StitchLoanDisbursementService;

describe.runIf(runIntegration)('Tenant isolation integration', () => {
  const prisma = new PrismaService();
  const scheduleService = new LoansScheduleService(prisma);
  const balanceService = new LoanBalanceService();
  const auditService = new AuditService(prisma);
  const billingService = {
    assertActiveLoanCapacity: async () => {},
  } as unknown as BillingService;
  const walletsService = {
    recordDisbursement: async () => {},
  } as unknown as WalletsService;
  const notificationDispatch = {
    notifyLoanActivated: async () => {},
    notifyLoanDisbursed: async () => {},
  } as unknown as NotificationDispatchService;
  const loanAgreementService = {
    assertDisbursementAllowed: async () => {},
    buildSummaryForLender: () => ({
      status: 'NOT_SENT',
      sentAt: null,
      signedAt: null,
      signerName: null,
      canSend: true,
      canDisburse: false,
      requiresBorrowerSignature: false,
      canSign: false,
    }),
  } as unknown as LoanAgreementService;
  const documentsService = {
    storeGeneratedContent: async () => ({}),
  } as unknown as import('../documents/documents.service').DocumentsService;
  const loansService = new LoansService(
    prisma,
    scheduleService,
    balanceService,
    auditService,
    billingService,
    walletsService,
    stitchLoanDisbursementMock,
    notificationDispatch,
    loanAgreementService,
    documentsService,
  );
  const borrowersService = new BorrowersService(prisma, balanceService, auditService);

  let orgAId = '';
  let orgBId = '';
  let userAId = '';
  let userBId = '';
  let borrowerAId = '';
  let loanAId = '';

  beforeAll(async () => {
    await prisma.$connect();

    const orgA = await prisma.organisation.create({
      data: { name: 'Tenant Isolation Org A', settings: {} },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organisation.create({
      data: { name: 'Tenant Isolation Org B', settings: {} },
    });
    orgBId = orgB.id;

    const userA = await prisma.user.create({
      data: {
        orgId: orgAId,
        email: `tenant-a-${Date.now()}@example.com`,
        name: 'Org A Admin',
        role: 'ADMIN',
        passwordHash: 'hash',
        emailVerifiedAt: new Date(),
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        orgId: orgBId,
        email: `tenant-b-${Date.now()}@example.com`,
        name: 'Org B Admin',
        role: 'ADMIN',
        passwordHash: 'hash',
        emailVerifiedAt: new Date(),
      },
    });
    userBId = userB.id;

    const borrowerA = await prisma.borrower.create({
      data: {
        orgId: orgAId,
        fullName: 'Org A Borrower',
        idNumber: `A${Date.now()}`,
        phone: '0800000001',
      },
    });
    borrowerAId = borrowerA.id;

    const loan = await loansService.create(orgAId, userAId, {
      borrowerId: borrowerAId,
      principalCents: 50_000,
      annualRate: 0,
      interestType: InterestType.FLAT,
      termPeriods: 2,
      frequency: RepaymentFrequency.MONTHLY,
      startDate: new Date('2025-01-01'),
    });
    loanAId = loan.id;
  }, 60_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { orgId: { in: [orgAId, orgBId].filter(Boolean) } },
    });
    if (loanAId) {
      await prisma.repayment.deleteMany({ where: { loanId: loanAId } });
      await prisma.repaymentSchedule.deleteMany({ where: { loanId: loanAId } });
      await prisma.loan.deleteMany({ where: { id: loanAId } });
    }
    if (borrowerAId) {
      await prisma.borrower.deleteMany({ where: { id: borrowerAId } });
    }
    if (userAId) {
      await prisma.user.deleteMany({ where: { id: userAId } });
    }
    if (userBId) {
      await prisma.user.deleteMany({ where: { id: userBId } });
    }
    if (orgAId) {
      await prisma.organisation.deleteMany({ where: { id: orgAId } });
    }
    if (orgBId) {
      await prisma.organisation.deleteMany({ where: { id: orgBId } });
    }
    await prisma.$disconnect();
  });

  it('org B cannot list org A borrowers', async () => {
    const result = await borrowersService.list(orgBId, userBId, {
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  }, 30_000);

  it('org B cannot read org A loan by id', async () => {
    await expect(
      loansService.getById(orgBId, userBId, loanAId),
    ).rejects.toThrow('Loan not found');
  }, 30_000);

  it('org A can read its own loan', async () => {
    const loan = await loansService.getById(orgAId, userAId, loanAId);
    expect(loan.id).toBe(loanAId);
  }, 30_000);
});
