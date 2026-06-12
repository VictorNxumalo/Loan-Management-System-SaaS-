import {
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post('stripe')
  handleStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body required for webhook verification');
    }

    return this.billingService.handleWebhookEvent(rawBody, signature);
  }
}
