import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { getEnv } from '../config/env';
import { NotificationSchedulerService } from './notification-scheduler.service';

@Injectable()
export class ReminderCronService implements OnModuleInit {
  private readonly logger = new Logger(ReminderCronService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly notificationSchedulerService: NotificationSchedulerService,
  ) {}

  onModuleInit() {
    if (!getEnv().CRON_REMINDER_ENABLED) {
      this.logger.log('Repayment reminder cron disabled');
      return;
    }

    const schedule = getEnv().CRON_REMINDER_SCHEDULE;
    const job = new CronJob(schedule, () => {
      void this.run('cron');
    });

    this.schedulerRegistry.addCronJob('repayment-reminder', job);
    job.start();
    this.logger.log(`Repayment reminder cron scheduled: ${schedule}`);
  }

  async run(trigger: 'cron' | 'manual' = 'manual') {
    this.logger.log(`Starting repayment reminder scan (${trigger})`);
    await this.notificationSchedulerService.runRepaymentReminderScan();
  }
}
