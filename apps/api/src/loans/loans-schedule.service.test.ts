import { InterestType, RepaymentFrequency } from '@lms/types';
import { describe, expect, it } from 'vitest';
import { LoansScheduleService } from './loans-schedule.service';

describe('LoansScheduleService', () => {
  const service = new LoansScheduleService({} as never);

  it('generates schedule rows in cents from DTO input', () => {
    const rows = service.generateSchedule({
      principalCents: 100_000,
      annualRate: 12,
      interestType: InterestType.FLAT,
      termPeriods: 12,
      frequency: RepaymentFrequency.MONTHLY,
      startDate: new Date('2025-01-01'),
    });

    expect(rows).toHaveLength(12);
    expect(rows[0]?.periodNumber).toBe(1);
    expect(rows[0]?.principalDueCents).toBeGreaterThan(0);
    expect(rows[0]?.totalDueCents).toBe(
      rows[0]!.principalDueCents + rows[0]!.interestDueCents,
    );
    expect(rows[11]?.balanceAfterCents).toBe(0);
  });

  it('builds schedule input with correct principal decimal', () => {
    const input = service.buildScheduleInput({
      principalCents: 50_000,
      annualRate: 8.5,
      interestType: InterestType.REDUCING,
      termPeriods: 6,
      frequency: RepaymentFrequency.WEEKLY,
      startDate: new Date('2025-06-01'),
    });

    expect(input.principal.toString()).toBe('500');
    expect(input.annualRate.toString()).toBe('8.5');
    expect(input.termPeriods).toBe(6);
    expect(input.frequency).toBe(RepaymentFrequency.WEEKLY);
  });
});
