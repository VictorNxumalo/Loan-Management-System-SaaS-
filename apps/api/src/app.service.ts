import { Injectable } from '@nestjs/common';
import { getEmailDeliveryStatus } from './config/env';
import { getSentryStatus } from './config/sentry';
import { PrismaService } from './prisma/prisma.service';
import { QueueService } from './queue/queue.service';

type DependencyStatus = 'ok' | 'degraded' | 'down';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  /** Lightweight liveness probe — used by Render load balancer. */
  getHealth() {
    return {
      status: 'ok',
      service: 'lms-api',
      timestamp: new Date().toISOString(),
      email: getEmailDeliveryStatus(),
      monitoring: getSentryStatus(),
    };
  }

  /** Readiness probe — verifies critical dependencies before traffic. */
  async getReadiness() {
    const checks: Record<string, DependencyStatus> = {
      database: await this.checkDatabase(),
      redis: this.queue.available ? 'ok' : 'degraded',
    };

    const status: 'ok' | 'degraded' | 'down' =
      checks.database === 'down'
        ? 'down'
        : Object.values(checks).includes('degraded')
          ? 'degraded'
          : 'ok';

    return {
      status,
      service: 'lms-api',
      timestamp: new Date().toISOString(),
      checks,
      email: getEmailDeliveryStatus(),
      monitoring: getSentryStatus(),
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
