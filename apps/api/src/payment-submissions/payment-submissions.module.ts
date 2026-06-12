import { Module } from '@nestjs/common';
import { LoansModule } from '../loans/loans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  BorrowerPaymentSubmissionsController,
  LenderPaymentSubmissionsController,
} from './payment-submissions.controller';
import { PaymentSubmissionsService } from './payment-submissions.service';

@Module({
  imports: [LoansModule, NotificationsModule],
  controllers: [BorrowerPaymentSubmissionsController, LenderPaymentSubmissionsController],
  providers: [PaymentSubmissionsService],
})
export class PaymentSubmissionsModule {}
