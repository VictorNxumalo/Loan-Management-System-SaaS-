import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  getEnv,
  getStitchTokenUrl,
  isStitchConfigured,
} from '../config/env';

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
  scope: string;
}

@Injectable()
export class StitchAuthService {
  private cache = new Map<string, CachedToken>();

  assertConfigured(): void {
    if (!isStitchConfigured()) {
      throw new ServiceUnavailableException(
        'Stitch is not configured. Set STITCH_CLIENT_ID and STITCH_CLIENT_SECRET.',
      );
    }
  }

  async getClientToken(scope: string): Promise<string> {
    this.assertConfigured();
    const env = getEnv();
    const cached = this.cache.get(scope);
    if (cached && Date.now() < cached.expiresAtMs - 60_000) {
      return cached.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.STITCH_CLIENT_ID!,
      client_secret: env.STITCH_CLIENT_SECRET!,
      audience: getStitchTokenUrl(),
      scope,
    });

    const res = await fetch(getStitchTokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await res.text();
    let json: { access_token?: string; expires_in?: number; scope?: string; error?: string };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new ServiceUnavailableException(
        `Stitch token request failed (${res.status}): invalid JSON`,
      );
    }

    if (!res.ok || !json.access_token) {
      throw new ServiceUnavailableException(
        `Stitch token request failed (${res.status}): ${json.error ?? text.slice(0, 200)}`,
      );
    }

    const expiresIn = json.expires_in ?? 3600;
    this.cache.set(scope, {
      accessToken: json.access_token,
      expiresAtMs: Date.now() + expiresIn * 1000,
      scope: json.scope ?? scope,
    });

    return json.access_token;
  }

  async getDisbursementToken(): Promise<string> {
    return this.getClientToken('client_disbursement');
  }

  async getBankVerificationToken(): Promise<string> {
    return this.getClientToken('client_bankaccountverification');
  }

  async getLinkPayToken(): Promise<string> {
    return this.getClientToken('client_paymentauthorizationrequest');
  }
}
