import { getTrialDays } from '../config/env';

export function computeTrialEndsAt(): Date {
  const ends = new Date();
  ends.setDate(ends.getDate() + getTrialDays());
  return ends;
}
