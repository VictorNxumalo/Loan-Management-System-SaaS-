import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { StitchAuthService } from './stitch-auth.service';
import { StitchDisbursementService } from './stitch-disbursement.service';
import { StitchLinkPayService } from './stitch-linkpay.service';
import { StitchLoanDisbursementService } from './stitch-loan-disbursement.service';
import { StitchWebhookController } from './stitch-webhook.controller';
import { StitchWebhookService } from './stitch-webhook.service';

@Module({
  imports: [NotificationsModule],
  controllers: [StitchWebhookController],
  providers: [
    StitchAuthService,
    StitchDisbursementService,
    StitchLoanDisbursementService,
    StitchLinkPayService,
    StitchWebhookService,
  ],
  exports: [StitchLoanDisbursementService, StitchLinkPayService, StitchAuthService],
})
export class StitchModule {}
