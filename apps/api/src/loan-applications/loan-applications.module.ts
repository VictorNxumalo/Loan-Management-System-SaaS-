import { Module } from '@nestjs/common';
import { BorrowerPortalModule } from '../borrower-portal/borrower-portal.module';
import { LoansModule } from '../loans/loans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApplicationDocumentsService } from './application-documents.service';
import { CreditDataService } from './credit-data.service';
import {
  BorrowerApplicationsController,
  LenderApplicationsController,
} from './loan-applications.controller';
import { LoanApplicationsService } from './loan-applications.service';

@Module({
  imports: [LoansModule, NotificationsModule, BorrowerPortalModule],
  controllers: [BorrowerApplicationsController, LenderApplicationsController],
  providers: [LoanApplicationsService, ApplicationDocumentsService, CreditDataService],
})
export class LoanApplicationsModule {}
