import type { InterestType, RepaymentFrequency } from '@lms/types';
import { InterestType as InterestTypeEnum, RepaymentFrequency as FrequencyEnum } from '@lms/types';
import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const MONEY_SCALE = 2;

const PERIODS_PER_YEAR: Record<RepaymentFrequency, number> = {
  [FrequencyEnum.WEEKLY]: 52,
  [FrequencyEnum.BI_WEEKLY]: 26,
  [FrequencyEnum.MONTHLY]: 12,
};

export interface SchedulePeriod {
  periodNumber: number;
  dueDate: Date;
  principalDue: Decimal;
  interestDue: Decimal;
  totalDue: Decimal;
  balanceAfter: Decimal;
}

export interface GenerateScheduleInput {
  principal: Decimal;
  annualRate: Decimal;
  interestType: InterestType;
  termPeriods: number;
  frequency: RepaymentFrequency;
  startDate: Date;
}

export interface RepaymentScheduleDbRow {
  periodNumber: number;
  dueDate: Date;
  principalDueCents: number;
  interestDueCents: number;
  totalDueCents: number;
  balanceAfterCents: number;
}

export interface SchedulePreviewPeriod {
  periodNumber: number;
  dueDate: string;
  principalDue: string;
  interestDue: string;
  totalDue: string;
  balanceAfter: string;
}

export interface SchedulePreviewSummary {
  totalPrincipal: string;
  totalInterest: string;
  totalRepayable: string;
  numberOfPeriods: number;
}

export interface SchedulePreviewResult {
  periods: SchedulePreviewPeriod[];
  summary: SchedulePreviewSummary;
}

export type LateFeeType = 'FLAT' | 'PERCENTAGE';
export type LateFeePeriodUnit = 'DAY' | 'WEEK';

export interface LateFeeConfig {
  type: LateFeeType;
  flatFee?: Decimal;
  percentageRate?: Decimal;
  periodUnit: LateFeePeriodUnit;
}

export interface PreviewScheduleOptions {
  currencyCode?: string;
  locale?: string;
}

/** Round a Decimal to standard currency precision (2 dp). */
export function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

/** Convert a money Decimal to integer cents for database storage. */
export function toCents(value: Decimal): number {
  return roundMoney(value).mul(100).toNumber();
}

/** Convert integer cents from the database to a money Decimal. */
export function fromCents(cents: number): Decimal {
  return new Decimal(cents).div(100);
}

/** Coerce numeric input to Decimal. */
export function toDecimal(value: Decimal | number | string): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Add calendar months to a date, clamping day-of-month when needed. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
}

/** Add days to a date. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function periodsPerYear(frequency: RepaymentFrequency): number {
  return PERIODS_PER_YEAR[frequency];
}

export function getPeriodicRate(
  annualRate: Decimal,
  frequency: RepaymentFrequency,
): Decimal {
  return annualRate.div(100).div(periodsPerYear(frequency));
}

export function getTermYears(
  termPeriods: number,
  frequency: RepaymentFrequency,
): Decimal {
  return new Decimal(termPeriods).div(periodsPerYear(frequency));
}

export function getDueDate(
  startDate: Date,
  periodNumber: number,
  frequency: RepaymentFrequency,
): Date {
  switch (frequency) {
    case FrequencyEnum.WEEKLY:
      return addDays(startDate, periodNumber * 7);
    case FrequencyEnum.BI_WEEKLY:
      return addDays(startDate, periodNumber * 14);
    case FrequencyEnum.MONTHLY:
      return addMonths(startDate, periodNumber);
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }
}

function assertValidScheduleInputs(
  principal: Decimal,
  termPeriods: number,
): void {
  if (termPeriods < 1) {
    throw new Error('termPeriods must be at least 1');
  }
  if (principal.isNegative()) {
    throw new Error('principal must be non-negative');
  }
}

/**
 * Flat-rate schedule: total interest = principal × annualRate × termYears.
 * Each period receives an equal share of principal and interest.
 */
export function calculateFlatRateSchedule(
  principal: Decimal,
  annualRate: Decimal,
  termPeriods: number,
  startDate: Date,
  frequency: RepaymentFrequency = FrequencyEnum.MONTHLY,
): SchedulePeriod[] {
  assertValidScheduleInputs(principal, termPeriods);

  const termYears = getTermYears(termPeriods, frequency);
  const rateDecimal = annualRate.div(100);
  const totalInterest = roundMoney(principal.mul(rateDecimal).mul(termYears));
  const totalRepayment = principal.plus(totalInterest);

  const basePrincipalPerPeriod = roundMoney(principal.div(termPeriods));
  const baseInterestPerPeriod = roundMoney(totalInterest.div(termPeriods));
  const basePaymentPerPeriod = roundMoney(totalRepayment.div(termPeriods));

  const schedule: SchedulePeriod[] = [];
  let remainingPrincipal = principal;
  let remainingInterest = totalInterest;

  for (let period = 1; period <= termPeriods; period++) {
    const isLast = period === termPeriods;

    const principalDue = isLast
      ? roundMoney(remainingPrincipal)
      : basePrincipalPerPeriod;
    const interestDue = isLast
      ? roundMoney(remainingInterest)
      : baseInterestPerPeriod;
    const totalDue = isLast
      ? roundMoney(principalDue.plus(interestDue))
      : basePaymentPerPeriod;

    remainingPrincipal = roundMoney(remainingPrincipal.minus(principalDue));
    remainingInterest = roundMoney(remainingInterest.minus(interestDue));

    schedule.push({
      periodNumber: period,
      dueDate: getDueDate(startDate, period, frequency),
      principalDue,
      interestDue,
      totalDue,
      balanceAfter: Decimal.max(remainingPrincipal, 0),
    });
  }

  return schedule;
}

/**
 * Reducing-balance (amortising) schedule using the standard annuity formula.
 * Periodic rate = annualRate / periodsPerYear.
 */
export function calculateReducingBalanceSchedule(
  principal: Decimal,
  annualRate: Decimal,
  termPeriods: number,
  startDate: Date,
  frequency: RepaymentFrequency = FrequencyEnum.MONTHLY,
): SchedulePeriod[] {
  assertValidScheduleInputs(principal, termPeriods);

  const periodicRate = getPeriodicRate(annualRate, frequency);

  let payment: Decimal;
  if (periodicRate.isZero()) {
    payment = roundMoney(principal.div(termPeriods));
  } else {
    const onePlusR = periodicRate.plus(1);
    const factor = onePlusR.pow(termPeriods);
    payment = roundMoney(
      principal.mul(periodicRate).mul(factor).div(factor.minus(1)),
    );
  }

  const schedule: SchedulePeriod[] = [];
  let balance = principal;

  for (let period = 1; period <= termPeriods; period++) {
    const isLast = period === termPeriods;
    const interestDue = roundMoney(balance.mul(periodicRate));

    let principalDue: Decimal;
    let totalDue: Decimal;

    if (isLast) {
      principalDue = roundMoney(balance);
      totalDue = roundMoney(principalDue.plus(interestDue));
    } else {
      totalDue = payment;
      principalDue = roundMoney(totalDue.minus(interestDue));
    }

    balance = roundMoney(balance.minus(principalDue));

    schedule.push({
      periodNumber: period,
      dueDate: getDueDate(startDate, period, frequency),
      principalDue,
      interestDue,
      totalDue,
      balanceAfter: Decimal.max(balance, 0),
    });
  }

  return schedule;
}

/** Unified entry point — selects flat or reducing calculation. */
export function generateRepaymentSchedule(
  input: GenerateScheduleInput,
): SchedulePeriod[] {
  if (input.interestType === InterestTypeEnum.FLAT) {
    return calculateFlatRateSchedule(
      input.principal,
      input.annualRate,
      input.termPeriods,
      input.startDate,
      input.frequency,
    );
  }

  return calculateReducingBalanceSchedule(
    input.principal,
    input.annualRate,
    input.termPeriods,
    input.startDate,
    input.frequency,
  );
}

/** Map a calculated schedule to integer-cent rows for database persistence. */
export function scheduleToDbRows(
  schedule: SchedulePeriod[],
): RepaymentScheduleDbRow[] {
  return schedule.map((period) => ({
    periodNumber: period.periodNumber,
    dueDate: period.dueDate,
    principalDueCents: toCents(period.principalDue),
    interestDueCents: toCents(period.interestDue),
    totalDueCents: toCents(period.totalDue),
    balanceAfterCents: toCents(period.balanceAfter),
  }));
}

/** Format a Decimal amount as a locale currency string. */
export function formatCurrency(
  amount: Decimal,
  currencyCode = 'ZAR',
  locale = 'en-ZA',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount.toNumber());
}

/** Format a date as a readable locale string. */
export function formatScheduleDate(date: Date, locale = 'en-ZA'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Run a full amortisation calculation and return a formatted preview
 * without persisting anything to the database.
 */
export function previewRepaymentSchedule(
  input: GenerateScheduleInput,
  options: PreviewScheduleOptions = {},
): SchedulePreviewResult {
  const currencyCode = options.currencyCode ?? 'ZAR';
  const locale = options.locale ?? 'en-ZA';

  const schedule = generateRepaymentSchedule(input);

  const totalPrincipal = schedule.reduce(
    (sum, p) => sum.plus(p.principalDue),
    new Decimal(0),
  );
  const totalInterest = schedule.reduce(
    (sum, p) => sum.plus(p.interestDue),
    new Decimal(0),
  );
  const totalRepayable = totalPrincipal.plus(totalInterest);

  return {
    periods: schedule.map((period) => ({
      periodNumber: period.periodNumber,
      dueDate: formatScheduleDate(period.dueDate, locale),
      principalDue: formatCurrency(period.principalDue, currencyCode, locale),
      interestDue: formatCurrency(period.interestDue, currencyCode, locale),
      totalDue: formatCurrency(period.totalDue, currencyCode, locale),
      balanceAfter: formatCurrency(period.balanceAfter, currencyCode, locale),
    })),
    summary: {
      totalPrincipal: formatCurrency(totalPrincipal, currencyCode, locale),
      totalInterest: formatCurrency(totalInterest, currencyCode, locale),
      totalRepayable: formatCurrency(totalRepayable, currencyCode, locale),
      numberOfPeriods: schedule.length,
    },
  };
}

/**
 * Calculate a late fee on an overdue amount.
 * FLAT: fixed fee per overdue period unit.
 * PERCENTAGE: percentage of overdue amount per overdue period unit.
 */
export function calculateLateFee(
  overdueAmount: Decimal,
  config: LateFeeConfig,
  periodsOverdue: number,
): Decimal {
  if (overdueAmount.isNegative()) {
    throw new Error('overdueAmount must be non-negative');
  }
  if (periodsOverdue < 0) {
    throw new Error('periodsOverdue must be non-negative');
  }

  if (config.type === 'FLAT') {
    if (!config.flatFee) {
      throw new Error('flatFee is required for FLAT late fee type');
    }
    return roundMoney(config.flatFee.mul(periodsOverdue));
  }

  if (!config.percentageRate) {
    throw new Error('percentageRate is required for PERCENTAGE late fee type');
  }

  const rateDecimal = config.percentageRate.div(100);
  return roundMoney(
    overdueAmount.mul(rateDecimal).mul(periodsOverdue),
  );
}
