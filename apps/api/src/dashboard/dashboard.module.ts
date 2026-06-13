import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoansModule } from '../loans/loans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletsModule } from '../wallets/wallets.module';
import { AdminController } from './admin.controller';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { OverdueCronService } from './overdue-cron.service';
import { OverdueSweepService } from './overdue-sweep.service';

@Module({
  imports: [ScheduleModule.forRoot(), LoansModule, NotificationsModule, WalletsModule],
  controllers: [DashboardController, AdminController],
  providers: [DashboardService, OverdueSweepService, OverdueCronService],
  exports: [DashboardService, OverdueSweepService],
})
export class DashboardModule {}
