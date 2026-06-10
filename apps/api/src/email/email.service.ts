import { Injectable, Logger } from '@nestjs/common';
import { getEnv, isSendGridConfigured } from '../config/env';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `${getEnv().NEXTAUTH_URL}/auth/verify-email?token=${token}`;
    const subject = 'Verify your LMS account';
    const body = `Click the link below to verify your email:\n\n${link}\n\nThis link expires in 24 hours.`;

    await this.send(email, subject, body, 'verification');
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const link = `${getEnv().NEXTAUTH_URL}/auth/reset-password?token=${token}`;
    const subject = 'Reset your LMS password';
    const body = `Click the link below to reset your password:\n\n${link}\n\nThis link expires in 1 hour.`;

    await this.send(email, subject, body, 'password-reset');
  }

  private async send(
    to: string,
    subject: string,
    body: string,
    type: string,
  ): Promise<void> {
    if (!isSendGridConfigured()) {
      this.logger.warn(
        `[DEV EMAIL - ${type}] To: ${to}\nSubject: ${subject}\n${body}`,
      );
      return;
    }

    const env = getEnv();
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.SENDGRID_FROM_EMAIL },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });

    if (!response.ok) {
      this.logger.error(`SendGrid error: ${response.status} ${await response.text()}`);
    }
  }
}
