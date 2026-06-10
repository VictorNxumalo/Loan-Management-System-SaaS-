import { InterestType, RepaymentFrequency } from '@lms/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { LoansScheduleService } from './loans-schedule.service';

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)('LoansScheduleService integration', () => {
  const prisma = new PrismaService();
  const service = new LoansScheduleService(prisma);

  let orgId: string;
  let userId: string;
  let borrowerId: string;
  let loanId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const org = await prisma.organisation.create({
      data: { name: 'Schedule Test Org' },
    });
    orgId = org.id;

    await prisma.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;

    const user = await prisma.user.create({
      data: {
        orgId,
        email: `schedule-test-${Date.now()}@example.com`,
        name: 'Schedule Tester',
        role: 'ADMIN',
        passwordHash: 'hash',
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;

    const borrower = await prisma.borrower.create({
      data: {
        orgId,
        fullName: 'Test Borrower',
        idNumber: `ID${Date.now()}`,
        phone: '+27000000000',
      },
    });
    borrowerId = borrower.id;

    const loan = await prisma.loan.create({
      data: {
        orgId,
        borrowerId,
        createdByUserId: userId,
        principalCents: 120_000,
        interestRate: 12,
        interestType: InterestType.REDUCING,
        termPeriods: 12,
        frequency: RepaymentFrequency.MONTHLY,
        startDate: new Date('2025-01-01'),
      },
    });
    loanId = loan.id;
  });

  afterAll(async () => {
    if (loanId) {
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

  it('persists repayment schedule rows for a loan', async () => {
    const count = await service.persistScheduleForLoan(loanId, orgId, userId, {
      principalCents: 120_000,
      annualRate: 12,
      interestType: InterestType.REDUCING,
      termPeriods: 12,
      frequency: RepaymentFrequency.MONTHLY,
      startDate: new Date('2025-01-01'),
    });

    expect(count).toBe(12);

    const rows = await prisma.withOrgContext(orgId, userId, (tx) =>
      tx.repaymentSchedule.findMany({
        where: { loanId },
        orderBy: { periodNumber: 'asc' },
      }),
    );

    expect(rows).toHaveLength(12);
    expect(rows[0]?.periodNumber).toBe(1);
    expect(rows[11]?.balanceAfterCents).toBe(0);
    expect(rows[0]?.totalDueCents).toBe(
      rows[0]!.principalDueCents + rows[0]!.interestDueCents,
    );
  });
});
