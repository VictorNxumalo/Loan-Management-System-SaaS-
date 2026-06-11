import { Module } from '@nestjs/common';
import { LoansModule } from '../loans/loans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  BorrowerApplicationsController,
  LenderApplicationsController,
} from './loan-applications.controller';
import { LoanApplicationsService } from './loan-applications.service';

@Module({
  imports: [LoansModule, NotificationsModule],
  controllers: [BorrowerApplicationsController, LenderApplicationsController],
  providers: [LoanApplicationsService],
})
export class LoanApplicationsModule {}
