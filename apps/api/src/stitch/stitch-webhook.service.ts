import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { getEnv, isStitchConfigured } from '../config/env';
import { StitchLoanDisbursementService } from './stitch-loan-disbursement.service';

@Injectable()
export class StitchWebhookService {
  constructor(
    private readonly loanDisbursement: StitchLoanDisbursementService,
  ) {}

  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): void {
    const secret = getEnv().STITCH_WEBHOOK_SECRET;
    if (!secret) {
      if (getEnv().NODE_ENV === 'production') {
        throw new BadRequestException('STITCH_WEBHOOK_SECRET not configured');
      }
      return;
    }

    if (!signatureHeader) {
      throw new UnauthorizedException('Missing X-Stitch-Signature header');
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/i, '').trim();

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid Stitch webhook signature');
    }
  }

  async handleDisbursementWebhook(rawBody: Buffer, signature?: string): Promise<{ ok: true }> {
    if (!isStitchConfigured()) {
      throw new BadRequestException('Stitch is not configured');
    }

    this.verifySignature(rawBody, signature);

    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const extracted = this.extractDisbursementEvent(body);
    if (extracted) {
      await this.loanDisbursement.applyWebhookUpdate(extracted);
    }

    return { ok: true };
  }

  private extractDisbursementEvent(body: unknown): {
    stitchDisbursementId?: string;
    externalReference?: string;
    status: string;
    statusReason?: string;
  } | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const root = body as Record<string, unknown>;
    const data = (root.data ?? root) as Record<string, unknown>;
    const disbursement = (data.disbursement ?? data) as Record<string, unknown>;

    const status = disbursement.status;
    if (typeof status !== 'string') {
      return null;
    }

    return {
      stitchDisbursementId:
        typeof disbursement.id === 'string' ? disbursement.id : undefined,
      externalReference:
        typeof disbursement.externalReference === 'string'
          ? disbursement.externalReference
          : undefined,
      status,
      statusReason:
        typeof disbursement.statusReason === 'string'
          ? disbursement.statusReason
          : typeof disbursement.reason === 'string'
            ? disbursement.reason
            : undefined,
    };
  }
}
