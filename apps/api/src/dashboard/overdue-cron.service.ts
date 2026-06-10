import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { getEnv } from '../config/env';
import { OverdueSweepService } from './overdue-sweep.service';

@Injectable()
export class OverdueCronService implements OnModuleInit {
  private readonly logger = new Logger(OverdueCronService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly overdueSweepService: OverdueSweepService,
  ) {}

  onModuleInit() {
    const env = getEnv();

    if (!env.CRON_OVERDUE_ENABLED) {
      this.logger.warn('Overdue cron is disabled (CRON_OVERDUE_ENABLED=false)');
      return;
    }

    const job = new CronJob(env.CRON_OVERDUE_SCHEDULE, () => {
      void this.runSweep('cron');
    });

    this.schedulerRegistry.addCronJob('overdue-sweep', job);
    job.start();

    this.logger.log(`Overdue cron scheduled: ${env.CRON_OVERDUE_SCHEDULE}`);
  }

  async runSweep(trigger: 'cron' | 'manual'): Promise<void> {
    this.logger.log(`Starting overdue sweep (${trigger})`);
    await this.overdueSweepService.sweepAllOrganisations();
  }
}
