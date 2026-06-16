import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getEnv, isDatanamixConfigured } from '../config/env';

export interface CreditPullRequest {
  idNumber: string;
  fullName: string;
  purpose: string;
  reference: string;
}

export interface CreditPullResponse {
  provider: string;
  status: string;
  score: number | null;
  summary: string | null;
  bureauSources: string[];
  requestPayload: Record<string, unknown>;
  rawResponse: Record<string, unknown>;
}

@Injectable()
export class CreditDataService {
  async pullReport(input: CreditPullRequest): Promise<CreditPullResponse> {
    if (!isDatanamixConfigured()) {
      throw new ServiceUnavailableException(
        'Datanamix is not configured. Set DATANAMIX_API_KEY in the API environment.',
      );
    }

    const env = getEnv();
    const payload = {
      consumer: {
        idNumber: input.idNumber,
        fullName: input.fullName,
      },
      purpose: input.purpose,
      reference: input.reference,
      include: ['TRANSUNION', 'EXPERIAN', 'XDS'],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.DATANAMIX_TIMEOUT_MS);
    try {
      const response = await fetch(`${env.DATANAMIX_API_BASE_URL}/credit/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DATANAMIX_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        return {
          provider: 'DATANAMIX',
          status: 'FAILED',
          score: null,
          summary: `Credit pull failed (${response.status})`,
          bureauSources: [],
          requestPayload: payload,
          rawResponse: parsed,
        };
      }

      const bureauSources = Array.isArray(parsed.bureaus)
        ? parsed.bureaus.filter((v): v is string => typeof v === 'string')
        : ['TRANSUNION', 'EXPERIAN', 'XDS'];
      const score = typeof parsed.score === 'number' ? parsed.score : null;
      const summary = typeof parsed.summary === 'string' ? parsed.summary : null;

      return {
        provider: 'DATANAMIX',
        status: 'SUCCESS',
        score,
        summary,
        bureauSources,
        requestPayload: payload,
        rawResponse: parsed,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
