import { Injectable, Logger } from '@nestjs/common';
import {
  getEnv,
  isAfricasTalkingConfigured,
  isTwilioConfigured,
} from '../config/env';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async send(to: string, message: string, context: string): Promise<void> {
    const normalised = to.trim();
    if (!normalised) {
      return;
    }

    if (isAfricasTalkingConfigured()) {
      await this.sendViaAfricasTalking(normalised, message, context);
      return;
    }

    if (isTwilioConfigured()) {
      await this.sendViaTwilio(normalised, message, context);
      return;
    }

    this.logger.warn(
      `[DEV SMS - ${context}] To: ${normalised}\n${message}`,
    );
  }

  private async sendViaAfricasTalking(
    to: string,
    message: string,
    context: string,
  ): Promise<void> {
    const env = getEnv();
    const response = await fetch(
      'https://api.africastalking.com/version1/messaging',
      {
        method: 'POST',
        headers: {
          apiKey: env.AFRICASTALKING_API_KEY!,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: env.AFRICASTALKING_USERNAME!,
          to,
          message,
        }),
      },
    );

    if (!response.ok) {
      this.logger.error(
        `Africa's Talking SMS error (${context}): ${response.status} ${await response.text()}`,
      );
    }
  }

  private async sendViaTwilio(
    to: string,
    message: string,
    context: string,
  ): Promise<void> {
    const env = getEnv();
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(
      `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
    ).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: env.TWILIO_FROM_NUMBER!,
        Body: message,
      }),
    });

    if (!response.ok) {
      this.logger.error(
        `Twilio SMS error (${context}): ${response.status} ${await response.text()}`,
      );
    }
  }
}
