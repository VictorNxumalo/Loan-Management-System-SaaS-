import { describe, expect, it, vi } from 'vitest';
import { AppService } from './app.service';

describe('AppService', () => {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  };
  const queue = { available: false };

  it('returns liveness health status', () => {
    const service = new AppService(prisma as never, queue as never);
    const health = service.getHealth();

    expect(health.status).toBe('ok');
    expect(health.service).toBe('lms-api');
    expect(health.timestamp).toBeDefined();
    expect(health.monitoring).toBeDefined();
  });

  it('returns readiness with database check', async () => {
    const service = new AppService(prisma as never, queue as never);
    const readiness = await service.getReadiness();

    expect(readiness.checks.database).toBe('ok');
    expect(readiness.checks.redis).toBe('degraded');
    expect(readiness.status).toBe('degraded');
  });
});
