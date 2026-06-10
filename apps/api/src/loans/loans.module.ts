import { Module } from '@nestjs/common';
import { LoanBalanceService } from './loan-balance.service';
import { LoansController } from './loans.controller';
import { LoansScheduleService } from './loans-schedule.service';
import { LoansService } from './loans.service';

@Module({
  controllers: [LoansController],
  providers: [LoansScheduleService, LoanBalanceService, LoansService],
  exports: [LoansScheduleService, LoanBalanceService, LoansService],
})
export class LoansModule {}
