import { Module } from '@nestjs/common';
import { WalletsModule } from '../wallets/wallets.module';
import { LoanBalanceService } from './loan-balance.service';
import { LoansController } from './loans.controller';
import { LoansScheduleService } from './loans-schedule.service';
import { LoansService } from './loans.service';

@Module({
  imports: [WalletsModule],
  controllers: [LoansController],
  providers: [LoansScheduleService, LoanBalanceService, LoansService],
  exports: [LoansScheduleService, LoanBalanceService, LoansService],
})
export class LoansModule {}
