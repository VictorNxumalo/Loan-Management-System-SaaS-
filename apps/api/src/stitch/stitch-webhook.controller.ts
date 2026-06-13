import {
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { StitchWebhookService } from './stitch-webhook.service';

@Controller('webhooks')
export class StitchWebhookController {
  constructor(private readonly webhookService: StitchWebhookService) {}

  @Post('stitch/disbursement')
  handleDisbursement(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-stitch-signature') signature: string | undefined,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body required for webhook verification');
    }

    return this.webhookService.handleDisbursementWebhook(rawBody, signature);
  }
}
