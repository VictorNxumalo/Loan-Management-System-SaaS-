import { PlanStatus } from '@lms/types';
import { describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service';

vi.mock('../config/env', () => ({
  getEnv: vi.fn(() => ({})),
  isStripeConfigured: vi.fn(() => false),
}));

describe('BillingService.syncPlanStatus', () => {
  it('marks expired trials as READ_ONLY', async () => {
    const update = vi.fn();
    const prisma = {
      withOrgContext: vi.fn(
        async (_orgId: string, _userId: string, fn: (tx: unknown) => Promise<void>) =>
          fn({
            organisation: {
              findFirstOrThrow: vi.fn().mockResolvedValue({
                planStatus: PlanStatus.TRIAL,
                trialEndsAt: new Date('2020-01-01'),
              }),
              update,
            },
          }),
      ),
    };

    const service = new BillingService(prisma as never);
    await service.syncPlanStatus('org-1', 'user-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { planStatus: PlanStatus.READ_ONLY },
    });
  });

  it('leaves active trials unchanged', async () => {
    const update = vi.fn();
    const prisma = {
      withOrgContext: vi.fn(
        async (_orgId: string, _userId: string, fn: (tx: unknown) => Promise<void>) =>
          fn({
            organisation: {
              findFirstOrThrow: vi.fn().mockResolvedValue({
                planStatus: PlanStatus.TRIAL,
                trialEndsAt: new Date('2099-01-01'),
              }),
              update,
            },
          }),
      ),
    };

    const service = new BillingService(prisma as never);
    await service.syncPlanStatus('org-1', 'user-1');

    expect(update).not.toHaveBeenCalled();
  });
});
