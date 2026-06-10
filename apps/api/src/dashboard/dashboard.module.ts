import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoansModule } from '../loans/loans.module';
import { AdminController } from './admin.controller';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { OverdueCronService } from './overdue-cron.service';
import { OverdueSweepService } from './overdue-sweep.service';

@Module({
  imports: [ScheduleModule.forRoot(), LoansModule],
  controllers: [DashboardController, AdminController],
  providers: [DashboardService, OverdueSweepService, OverdueCronService],
  exports: [DashboardService, OverdueSweepService],
})
export class DashboardModule {}
