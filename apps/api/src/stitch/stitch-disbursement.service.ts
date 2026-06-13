import { BadRequestException, Injectable } from '@nestjs/common';
import { getStitchApiBaseUrl } from '../config/env';
import { StitchAuthService } from './stitch-auth.service';
import {
  centsToStitchQuantity,
  formatStitchBeneficiaryName,
  resolveStitchBankId,
} from './stitch-bank.util';

export interface StitchCreateDisbursementInput {
  amountCents: number;
  nonce: string;
  externalReference: string;
  beneficiaryReference: string;
  beneficiaryName: string;
  beneficiaryAccountNumber: string;
  beneficiaryBankName: string;
  type?: 'instant' | 'default';
}

export interface StitchDisbursementResponse {
  id: string;
  status: string;
  statusReason?: string;
  externalReference?: string;
}

@Injectable()
export class StitchDisbursementService {
  constructor(private readonly auth: StitchAuthService) {}

  async createDisbursement(
    input: StitchCreateDisbursementInput,
  ): Promise<StitchDisbursementResponse> {
    const token = await this.auth.getDisbursementToken();
    const bankId = resolveStitchBankId(input.beneficiaryBankName);

    const body = {
      amount: {
        currency: 'ZAR',
        quantity: centsToStitchQuantity(input.amountCents),
      },
      nonce: input.nonce,
      externalReference: input.externalReference,
      beneficiaryReference: input.beneficiaryReference.slice(0, 20),
      beneficiary: {
        name: formatStitchBeneficiaryName(input.beneficiaryName),
        accountNumber: input.beneficiaryAccountNumber.replace(/\s/g, ''),
        bank: bankId,
      },
      type: input.type ?? 'default',
    };

    const res = await fetch(`${getStitchApiBaseUrl()}/disbursements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: StitchDisbursementResponse & { message?: string; error?: string };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new BadRequestException(
        `Stitch disbursement failed (${res.status}): invalid response`,
      );
    }

    if (!res.ok) {
      throw new BadRequestException(
        `Stitch disbursement failed (${res.status}): ${json.message ?? json.error ?? text.slice(0, 300)}`,
      );
    }

    if (!json.id) {
      throw new BadRequestException('Stitch disbursement response missing id');
    }

    return json;
  }

  async getDisbursement(stitchId: string): Promise<StitchDisbursementResponse> {
    const token = await this.auth.getDisbursementToken();
    const res = await fetch(`${getStitchApiBaseUrl()}/disbursements/${encodeURIComponent(stitchId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await res.text();
    const json = JSON.parse(text) as StitchDisbursementResponse;
    if (!res.ok) {
      throw new BadRequestException(
        `Stitch disbursement lookup failed (${res.status})`,
      );
    }
    return json;
  }
}
