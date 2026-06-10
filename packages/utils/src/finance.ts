import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const MONEY_SCALE = 2;

export interface SchedulePeriod {
  periodNumber: number;
  dueDate: Date;
  principalDue: Decimal;
  interestDue: Decimal;
  totalDue: Decimal;
  balanceAfter: Decimal;
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

/**
 * Flat-rate schedule: total interest = principal × annualRate × termYears.
 * Each period receives an equal share of principal and interest.
 */
export function calculateFlatRateSchedule(
  principal: Decimal,
  annualRate: Decimal,
  termMonths: number,
  startDate: Date,
): SchedulePeriod[] {
  if (termMonths < 1) {
    throw new Error('termMonths must be at least 1');
  }
  if (principal.isNegative()) {
    throw new Error('principal must be non-negative');
  }

  const termYears = new Decimal(termMonths).div(12);
  const rateDecimal = annualRate.div(100);
  const totalInterest = roundMoney(principal.mul(rateDecimal).mul(termYears));
  const totalRepayment = principal.plus(totalInterest);

  const basePrincipalPerPeriod = roundMoney(principal.div(termMonths));
  const baseInterestPerPeriod = roundMoney(totalInterest.div(termMonths));
  const basePaymentPerPeriod = roundMoney(
    totalRepayment.div(termMonths),
  );

  const schedule: SchedulePeriod[] = [];
  let remainingPrincipal = principal;
  let remainingInterest = totalInterest;

  for (let period = 1; period <= termMonths; period++) {
    const isLast = period === termMonths;

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

    const balanceAfter = Decimal.max(remainingPrincipal, 0);

    schedule.push({
      periodNumber: period,
      dueDate: addMonths(startDate, period),
      principalDue,
      interestDue,
      totalDue,
      balanceAfter,
    });
  }

  return schedule;
}

/**
 * Reducing-balance (amortising) schedule using the standard annuity formula.
 * Periodic rate = annualRate / 12 (monthly periods).
 */
export function calculateReducingBalanceSchedule(
  principal: Decimal,
  annualRate: Decimal,
  termMonths: number,
  startDate: Date,
): SchedulePeriod[] {
  if (termMonths < 1) {
    throw new Error('termMonths must be at least 1');
  }
  if (principal.isNegative()) {
    throw new Error('principal must be non-negative');
  }

  const monthlyRate = annualRate.div(100).div(12);

  let payment: Decimal;
  if (monthlyRate.isZero()) {
    payment = roundMoney(principal.div(termMonths));
  } else {
    const onePlusR = monthlyRate.plus(1);
    const factor = onePlusR.pow(termMonths);
    payment = roundMoney(
      principal.mul(monthlyRate).mul(factor).div(factor.minus(1)),
    );
  }

  const schedule: SchedulePeriod[] = [];
  let balance = principal;

  for (let period = 1; period <= termMonths; period++) {
    const isLast = period === termMonths;
    const interestDue = roundMoney(balance.mul(monthlyRate));

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
      dueDate: addMonths(startDate, period),
      principalDue,
      interestDue,
      totalDue,
      balanceAfter: Decimal.max(balance, 0),
    });
  }

  return schedule;
}
