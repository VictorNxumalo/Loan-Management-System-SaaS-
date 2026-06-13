import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { StitchModule } from '../stitch/stitch.module';
import { WalletsModule } from '../wallets/wallets.module';
import { LoanBalanceService } from './loan-balance.service';
import { LoansController } from './loans.controller';
import { LoansScheduleService } from './loans-schedule.service';
import { LoansService } from './loans.service';

@Module({
  imports: [WalletsModule, StitchModule, NotificationsModule],
  controllers: [LoansController],
  providers: [LoansScheduleService, LoanBalanceService, LoansService],
  exports: [LoansScheduleService, LoanBalanceService, LoansService],
})
export class LoansModule {}
