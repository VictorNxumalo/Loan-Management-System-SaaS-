import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  addMonths,
  calculateFlatRateSchedule,
  calculateReducingBalanceSchedule,
  fromCents,
  roundMoney,
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

describe('calculateFlatRateSchedule', () => {
  it('generates correct number of periods with due dates', () => {
    const start = new Date('2025-01-01');
    const schedule = calculateFlatRateSchedule(d('10000'), d('12'), 12, start);

    expect(schedule).toHaveLength(12);
    expect(schedule[0]?.periodNumber).toBe(1);
    expect(schedule[11]?.periodNumber).toBe(12);
    expect(schedule[0]?.dueDate).toEqual(addMonths(start, 1));
    expect(schedule[11]?.dueDate).toEqual(addMonths(start, 12));
  });

  it('calculates flat-rate interest correctly', () => {
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
    expect(schedule[11]?.balanceAfter.toString()).toBe('0');
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

    const totalPaid = schedule.reduce(
      (sum, period) => sum.plus(period.totalDue),
      new Decimal(0),
    );
    expect(totalPaid.toString()).toBe('6000');
    expect(schedule[5]?.balanceAfter.toString()).toBe('0');
  });

  it('handles single-period loan', () => {
    const schedule = calculateFlatRateSchedule(
      d('5000'),
      d('10'),
      1,
      new Date('2025-06-01'),
    );

    expect(schedule).toHaveLength(1);
    expect(schedule[0]?.principalDue.toString()).toBe('5000');
    expect(schedule[0]?.interestDue.toString()).toBe('41.67');
    expect(schedule[0]?.totalDue.toString()).toBe('5041.67');
    expect(schedule[0]?.balanceAfter.toString()).toBe('0');
  });

  it('maintains rounding consistency — totals reconcile to principal + interest', () => {
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
    const totalInterest = schedule.reduce(
      (sum, p) => sum.plus(p.interestDue),
      new Decimal(0),
    );
    const totalDue = schedule.reduce(
      (sum, p) => sum.plus(p.totalDue),
      new Decimal(0),
    );

    expect(totalPrincipal.toString()).toBe(principal.toString());
    expect(totalDue.toString()).toBe(
      totalPrincipal.plus(totalInterest).toString(),
    );
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
    expect(schedule[0]?.dueDate).toEqual(addMonths(start, 1));
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
      expect(period.principalDue.toString()).toBe('1000');
    });

    expect(schedule[11]?.balanceAfter.toString()).toBe('0');
  });

  it('handles single-period loan', () => {
    const schedule = calculateReducingBalanceSchedule(
      d('8000'),
      d('15'),
      1,
      new Date('2025-01-01'),
    );

    expect(schedule).toHaveLength(1);
    expect(schedule[0]?.principalDue.toString()).toBe('8000');
    expect(schedule[0]?.interestDue.toString()).toBe('100');
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

  it('maintains rounding consistency — principal fully repaid', () => {
    const principal = d('25000');
    const schedule = calculateReducingBalanceSchedule(
      principal,
      d('9.5'),
      24,
      new Date('2025-01-01'),
    );

    const totalPrincipal = schedule.reduce(
      (sum, p) => sum.plus(p.principalDue),
      new Decimal(0),
    );
    const totalPaid = schedule.reduce(
      (sum, p) => sum.plus(p.totalDue),
      new Decimal(0),
    );
    const totalInterest = schedule.reduce(
      (sum, p) => sum.plus(p.interestDue),
      new Decimal(0),
    );

    expect(totalPrincipal.toString()).toBe(principal.toString());
    expect(totalPaid.toString()).toBe(
      principal.plus(totalInterest).toString(),
    );
    expect(schedule[23]?.balanceAfter.toString()).toBe('0');

    schedule.forEach((period) => {
      expect(period.totalDue.toString()).toBe(
        period.principalDue.plus(period.interestDue).toString(),
      );
    });
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
});
