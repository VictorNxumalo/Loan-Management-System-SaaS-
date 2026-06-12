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

  async sendBorrowerInviteEmail(
    email: string,
    lenderName: string,
    link: string,
  ): Promise<void> {
    const subject = `${lenderName} invited you to connect on LMS`;
    const body = `${lenderName} would like to connect with you as a borrower on LMS.\n\nAccept the invite:\n${link}\n\nThis link expires in 14 days.`;

    await this.send(email, subject, body, 'borrower-invite');
  }

  async sendTeamInviteEmail(
    email: string,
    organisationName: string,
    roleLabel: string,
    link: string,
  ): Promise<void> {
    const subject = `You've been invited to join ${organisationName} on LMS`;
    const body = `You have been invited to join ${organisationName} as a ${roleLabel} on LMS.\n\nCreate your account using this link:\n${link}\n\nThis link expires in 14 days.`;

    await this.send(email, subject, body, 'team-invite');
  }

  async sendApplicationSubmittedEmail(
    email: string,
    borrowerName: string,
    principalFormatted: string,
    link: string,
  ): Promise<void> {
    const subject = `New loan application from ${borrowerName}`;
    const body = `${borrowerName} submitted a loan application for ${principalFormatted}.\n\nReview it here:\n${link}`;

    await this.send(email, subject, body, 'application-submitted');
  }

  async sendApplicationApprovedEmail(
    email: string,
    organisationName: string,
    principalFormatted: string,
    link: string,
  ): Promise<void> {
    const subject = `Your loan application was approved — ${organisationName}`;
    const body = `${organisationName} approved your application for ${principalFormatted}.\n\nView details:\n${link}`;

    await this.send(email, subject, body, 'application-approved');
  }

  async sendApplicationRejectedEmail(
    email: string,
    organisationName: string,
    principalFormatted: string,
    reason: string,
    link: string,
  ): Promise<void> {
    const subject = `Update on your loan application — ${organisationName}`;
    const body = `${organisationName} declined your application for ${principalFormatted}.\n\nReason: ${reason}\n\nView details:\n${link}`;

    await this.send(email, subject, body, 'application-rejected');
  }

  async sendRepaymentReminderEmail(
    email: string,
    organisationName: string,
    dueDate: string,
    amountFormatted: string,
    link: string,
  ): Promise<void> {
    const subject = `Repayment reminder — due ${dueDate}`;
    const body = `Your repayment of ${amountFormatted} to ${organisationName} is due on ${dueDate} (in 3 days).\n\nView your loan:\n${link}`;

    await this.send(email, subject, body, 'repayment-reminder');
  }

  async sendLoanOverdueEmail(
    email: string,
    borrowerName: string,
    daysOverdue: number,
    outstandingFormatted: string,
    link: string,
  ): Promise<void> {
    const subject = `Loan overdue — ${borrowerName}`;
    const body = `The loan for ${borrowerName} is ${daysOverdue} day(s) overdue with ${outstandingFormatted} outstanding.\n\nReview the loan:\n${link}`;

    await this.send(email, subject, body, 'loan-overdue');
  }

  async sendPaymentSubmittedEmail(
    email: string,
    borrowerName: string,
    amountFormatted: string,
    paymentDate: string,
    link: string,
  ): Promise<void> {
    const subject = `Borrower payment submitted — ${borrowerName}`;
    const body = `${borrowerName} reported a payment of ${amountFormatted} on ${paymentDate}.\n\nReview and record it:\n${link}`;

    await this.send(email, subject, body, 'payment-submitted');
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
