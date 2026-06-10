import { InterestType, RepaymentFrequency } from '@lms/types';
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  calculateFlatRateSchedule,
  calculateLateFee,
  calculateReducingBalanceSchedule,
  formatCurrency,
  fromCents,
  generateRepaymentSchedule,
  getDueDate,
  getPeriodicRate,
  previewRepaymentSchedule,
  roundMoney,
  scheduleToDbRows,
  toCents,
} from './finance';

const d = (value: string | number) => new Decimal(value);

describe('money helpers', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundMoney(d('10.005')).toString()).toBe('10.01');
    expect(roundMoney(d('10.004')).toString()).toBe('10');
  });

  it('converts between cents and decimal', () => {
    expect(toCents(d('15.50'))).toBe(1550);
    expect(fromCents(1550).toString()).toBe('15.5');
  });

  it('formats ZAR currency', () => {
    const formatted = formatCurrency(d('1250'), 'ZAR', 'en-ZA');
    expect(formatted).toContain('R');
    expect(formatted).toMatch(/1.250/);
  });
});

describe('addMonths', () => {
  it('advances by whole months', () => {
    const start = new Date('2025-01-15');
    const result = addMonths(start, 1);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(15);
  });

  it('clamps end-of-month overflow', () => {
    const start = new Date('2025-01-31');
    const result = addMonths(start, 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });
});

describe('addDays and getDueDate', () => {
  it('advances weekly due dates', () => {
    const start = new Date('2025-01-01');
    expect(getDueDate(start, 1, RepaymentFrequency.WEEKLY)).toEqual(
      addDays(start, 7),
    );
    expect(getDueDate(start, 4, RepaymentFrequency.WEEKLY)).toEqual(
      addDays(start, 28),
    );
  });

  it('advances bi-weekly due dates', () => {
    const start = new Date('2025-01-01');
    expect(getDueDate(start, 2, RepaymentFrequency.BI_WEEKLY)).toEqual(
      addDays(start, 28),
    );
  });
});

describe('getPeriodicRate', () => {
  it('converts annual rate to weekly periodic rate', () => {
    const weekly = getPeriodicRate(d('52'), RepaymentFrequency.WEEKLY);
    expect(weekly.toString()).toBe('0.01');
  });
});

describe('calculateFlatRateSchedule', () => {
  it('generates correct number of periods with due dates', () => {
    const start = new Date('2025-01-01');
    const schedule = calculateFlatRateSchedule(d('10000'), d('12'), 12, start);

    expect(schedule).toHaveLength(12);
    expect(schedule[0]?.periodNumber).toBe(1);
    expect(schedule[11]?.periodNumber).toBe(12);
    expect(schedule[0]?.dueDate).toEqual(addMonths(start, 1));
    expect(schedule[11]?.balanceAfter.toString()).toBe('0');
  });

  it('calculates flat-rate interest correctly for monthly', () => {
    const schedule = calculateFlatRateSchedule(
      d('10000'),
      d('12'),
      12,
      new Date('2025-01-01'),
    );

    const totalInterest = schedule.reduce(
      (sum, period) => sum.plus(period.interestDue),
      new Decimal(0),
    );
    const totalPrincipal = schedule.reduce(
      (sum, period) => sum.plus(period.principalDue),
      new Decimal(0),
    );

    expect(totalPrincipal.toString()).toBe('10000');
    expect(totalInterest.toString()).toBe('1200');
  });

  it('handles weekly frequency', () => {
    const schedule = calculateFlatRateSchedule(
      d('5200'),
      d('52'),
      52,
      new Date('2025-01-01'),
      RepaymentFrequency.WEEKLY,
    );

    expect(schedule).toHaveLength(52);
    const totalInterest = schedule.reduce(
      (sum, p) => sum.plus(p.interestDue),
      new Decimal(0),
    );
    // 52% p.a. over 52 weeks (1 year) on 5200 = 2704 interest
    expect(totalInterest.toString()).toBe('2704');
    expect(schedule[0]?.dueDate).toEqual(
      getDueDate(new Date('2025-01-01'), 1, RepaymentFrequency.WEEKLY),
    );
  });

  it('handles zero interest', () => {
    const schedule = calculateFlatRateSchedule(
      d('6000'),
      d('0'),
      6,
      new Date('2025-01-01'),
    );

    schedule.forEach((period) => {
      expect(period.interestDue.toString()).toBe('0');
      expect(period.totalDue.toString()).toBe('1000');
    });
  });

  it('handles single-period loan', () => {
    const schedule = calculateFlatRateSchedule(
      d('5000'),
      d('10'),
      1,
      new Date('2025-06-01'),
    );

    expect(schedule).toHaveLength(1);
    expect(schedule[0]?.totalDue.toString()).toBe('5041.67');
    expect(schedule[0]?.balanceAfter.toString()).toBe('0');
  });

  it('maintains rounding consistency', () => {
    const principal = d('12345.67');
    const schedule = calculateFlatRateSchedule(
      principal,
      d('8.75'),
      18,
      new Date('2025-03-01'),
    );

    const totalPrincipal = schedule.reduce(
      (sum, p) => sum.plus(p.principalDue),
      new Decimal(0),
    );
    expect(totalPrincipal.toString()).toBe(principal.toString());
    expect(schedule[17]?.balanceAfter.toString()).toBe('0');
  });
});

describe('calculateReducingBalanceSchedule', () => {
  it('generates correct number of periods', () => {
    const start = new Date('2025-01-01');
    const schedule = calculateReducingBalanceSchedule(
      d('100000'),
      d('12'),
      360,
      start,
    );

    expect(schedule).toHaveLength(360);
    expect(schedule[359]?.balanceAfter.toString()).toBe('0');
  });

  it('handles zero interest — equal principal payments', () => {
    const schedule = calculateReducingBalanceSchedule(
      d('12000'),
      d('0'),
      12,
      new Date('2025-01-01'),
    );

    schedule.forEach((period) => {
      expect(period.interestDue.toString()).toBe('0');
      expect(period.totalDue.toString()).toBe('1000');
    });
  });

  it('handles single-period loan', () => {
    const schedule = calculateReducingBalanceSchedule(
      d('8000'),
      d('15'),
      1,
      new Date('2025-01-01'),
    );

    expect(schedule[0]?.totalDue.toString()).toBe('8100');
    expect(schedule[0]?.balanceAfter.toString()).toBe('0');
  });

  it('decreases interest over time with reducing balance', () => {
    const schedule = calculateReducingBalanceSchedule(
      d('10000'),
      d('12'),
      12,
      new Date('2025-01-01'),
    );

    const firstInterest = schedule[0]?.interestDue ?? d(0);
    const lastInterest = schedule[11]?.interestDue ?? d(0);
    expect(firstInterest.gt(lastInterest)).toBe(true);
  });

  it('matches known amortisation payment for standard loan', () => {
    const schedule = calculateReducingBalanceSchedule(
      d('200000'),
      d('6'),
      360,
      new Date('2025-01-01'),
    );

    expect(schedule[0]?.totalDue.toString()).toBe('1199.1');
    expect(schedule[0]?.interestDue.toString()).toBe('1000');
    expect(schedule[0]?.principalDue.toString()).toBe('199.1');
  });

  it('supports bi-weekly reducing balance', () => {
    const schedule = calculateReducingBalanceSchedule(
      d('10000'),
      d('26'),
      26,
      new Date('2025-01-01'),
      RepaymentFrequency.BI_WEEKLY,
    );

    expect(schedule).toHaveLength(26);
    expect(schedule[25]?.balanceAfter.toString()).toBe('0');
  });
});

describe('generateRepaymentSchedule', () => {
  it('routes to flat rate calculation', () => {
    const schedule = generateRepaymentSchedule({
      principal: d('10000'),
      annualRate: d('12'),
      interestType: InterestType.FLAT,
      termPeriods: 12,
      frequency: RepaymentFrequency.MONTHLY,
      startDate: new Date('2025-01-01'),
    });

    expect(schedule).toHaveLength(12);
  });

  it('routes to reducing balance calculation', () => {
    const schedule = generateRepaymentSchedule({
      principal: d('10000'),
      annualRate: d('12'),
      interestType: InterestType.REDUCING,
      termPeriods: 12,
      frequency: RepaymentFrequency.MONTHLY,
      startDate: new Date('2025-01-01'),
    });

    expect(schedule).toHaveLength(12);
    expect(schedule[0]?.interestDue.gt(schedule[11]!.interestDue)).toBe(true);
  });
});

describe('scheduleToDbRows', () => {
  it('converts schedule periods to integer cents', () => {
    const schedule = calculateFlatRateSchedule(
      d('1000'),
      d('0'),
      2,
      new Date('2025-01-01'),
    );
    const rows = scheduleToDbRows(schedule);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.principalDueCents).toBe(50000);
    expect(rows[0]?.interestDueCents).toBe(0);
    expect(rows[0]?.totalDueCents).toBe(50000);
    expect(rows[1]?.balanceAfterCents).toBe(0);
  });
});

describe('previewRepaymentSchedule', () => {
  it('returns formatted periods and summary without persisting', () => {
    const preview = previewRepaymentSchedule({
      principal: d('10000'),
      annualRate: d('12'),
      interestType: InterestType.REDUCING,
      termPeriods: 12,
      frequency: RepaymentFrequency.MONTHLY,
      startDate: new Date('2025-01-15'),
    });

    expect(preview.periods).toHaveLength(12);
    expect(preview.summary.numberOfPeriods).toBe(12);
    expect(preview.periods[0]?.periodNumber).toBe(1);
    expect(preview.periods[0]?.dueDate).toMatch(/2025/);
    expect(preview.periods[0]?.principalDue).toMatch(/R/);
    expect(preview.periods[0]?.interestDue).toMatch(/R/);
    expect(preview.periods[0]?.totalDue).toMatch(/R/);
    expect(preview.periods[0]?.balanceAfter).toMatch(/R/);
    expect(preview.summary.totalPrincipal).toMatch(/R/);
    expect(preview.summary.totalInterest).toMatch(/R/);
    expect(preview.summary.totalRepayable).toMatch(/R/);
  });

  it('summary totals reconcile with period sums', () => {
    const input = {
      principal: d('5000'),
      annualRate: d('10'),
      interestType: InterestType.FLAT,
      termPeriods: 6,
      frequency: RepaymentFrequency.MONTHLY,
      startDate: new Date('2025-03-01'),
    };

    const preview = previewRepaymentSchedule(input);
    const schedule = generateRepaymentSchedule(input);

    const totalPrincipal = schedule.reduce(
      (sum, p) => sum.plus(p.principalDue),
      new Decimal(0),
    );
    const totalInterest = schedule.reduce(
      (sum, p) => sum.plus(p.interestDue),
      new Decimal(0),
    );

    expect(preview.summary.totalPrincipal).toBe(
      formatCurrency(totalPrincipal, 'ZAR', 'en-ZA'),
    );
    expect(preview.summary.totalInterest).toBe(
      formatCurrency(totalInterest, 'ZAR', 'en-ZA'),
    );
    expect(preview.summary.totalRepayable).toBe(
      formatCurrency(totalPrincipal.plus(totalInterest), 'ZAR', 'en-ZA'),
    );
  });

  it('respects custom currency and locale options', () => {
    const preview = previewRepaymentSchedule(
      {
        principal: d('1000'),
        annualRate: d('0'),
        interestType: InterestType.FLAT,
        termPeriods: 1,
        frequency: RepaymentFrequency.MONTHLY,
        startDate: new Date('2025-06-01'),
      },
      { currencyCode: 'USD', locale: 'en-US' },
    );

    expect(preview.periods[0]?.totalDue).toMatch(/\$/);
    expect(preview.summary.totalPrincipal).toMatch(/\$/);
  });
});

describe('calculateLateFee', () => {
  it('calculates flat late fee per period', () => {
    const fee = calculateLateFee(
      d('1000'),
      { type: 'FLAT', flatFee: d('50'), periodUnit: 'WEEK' },
      2,
    );
    expect(fee.toString()).toBe('100');
  });

  it('calculates percentage late fee per period', () => {
    const fee = calculateLateFee(
      d('2000'),
      {
        type: 'PERCENTAGE',
        percentageRate: d('5'),
        periodUnit: 'DAY',
      },
      3,
    );
    expect(fee.toString()).toBe('300');
  });

  it('returns zero when periods overdue is zero', () => {
    const fee = calculateLateFee(
      d('1000'),
      { type: 'FLAT', flatFee: d('25'), periodUnit: 'DAY' },
      0,
    );
    expect(fee.toString()).toBe('0');
  });

  it('throws when flat fee config is missing flatFee', () => {
    expect(() =>
      calculateLateFee(
        d('100'),
        { type: 'FLAT', periodUnit: 'DAY' },
        1,
      ),
    ).toThrow('flatFee is required');
  });
});
