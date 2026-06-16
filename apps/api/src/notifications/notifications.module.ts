import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationRealtimeService } from './notification-realtime.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReminderCronService } from './reminder-cron.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationRealtimeService,
    NotificationDispatchService,
    NotificationSchedulerService,
    ReminderCronService,
  ],
  exports: [
    NotificationDispatchService,
    NotificationsService,
    NotificationSchedulerService,
    ReminderCronService,
  ],
})
export class NotificationsModule {}
