import { Injectable } from '@nestjs/common';

/**
 * LinkPay — lender bank linking and per-loan pay-in (phase 2).
 * @see https://docs.stitch.money/payment-products/payins/linkpay/integration-process
 */
@Injectable()
export class StitchLinkPayService {
  /** Placeholder until LinkPay OAuth redirect flow is wired in the web app. */
  linkPayNotConfiguredMessage(): string {
    return (
      'Stitch LinkPay is not yet integrated. Lender bank pulls will be added in the next phase. ' +
      'For now, fund your Stitch float account for disbursement testing.'
    );
  }
}
