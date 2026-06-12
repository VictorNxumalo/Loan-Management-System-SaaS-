import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlanGuard } from '../common/guards/plan.guard';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, PlanGuard],
  exports: [BillingService, PlanGuard],
})
export class BillingModule {}
