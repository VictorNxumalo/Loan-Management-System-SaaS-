import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeTrialEndsAt } from './trial.util';

vi.mock('../config/env', () => ({
  getTrialDays: vi.fn(() => 14),
}));

describe('computeTrialEndsAt', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds configured trial days from now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00.000Z'));

    const ends = computeTrialEndsAt();

    expect(ends.toISOString()).toBe('2025-06-15T12:00:00.000Z');
  });
});
