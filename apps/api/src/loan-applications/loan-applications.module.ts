import { Module } from '@nestjs/common';
import { LoansModule } from '../loans/loans.module';
import {
  BorrowerApplicationsController,
  LenderApplicationsController,
} from './loan-applications.controller';
import { LoanApplicationsService } from './loan-applications.service';

@Module({
  imports: [LoansModule],
  controllers: [BorrowerApplicationsController, LenderApplicationsController],
  providers: [LoanApplicationsService],
})
export class LoanApplicationsModule {}
