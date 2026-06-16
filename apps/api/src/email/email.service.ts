import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getEnv, isBrevoConfigured } from '../config/env';

type SendOptions = {
  /** When true, missing Brevo config or API errors fail the caller (signup, resend). */
  required?: boolean;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `${getEnv().NEXTAUTH_URL}/auth/verify-email?token=${token}`;
    const subject = 'Verify your LMS account';
    const body = `Click the link below to verify your email:\n\n${link}\n\nThis link expires in 24 hours.`;

    await this.send(email, subject, body, 'verification', { required: true });
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

  async sendPaymentConfirmedEmail(
    email: string,
    organisationName: string,
    amountFormatted: string,
    paymentDate: string,
    link: string,
  ): Promise<void> {
    const subject = `Payment recorded — ${organisationName}`;
    const body = `${organisationName} confirmed your payment of ${amountFormatted} on ${paymentDate}.\n\nView your loan:\n${link}`;

    await this.send(email, subject, body, 'payment-confirmed');
  }

  async sendPaymentRejectedEmail(
    email: string,
    organisationName: string,
    amountFormatted: string,
    paymentDate: string,
    reason: string,
    link: string,
  ): Promise<void> {
    const subject = `Payment not accepted — ${organisationName}`;
    const body = `${organisationName} could not accept your reported payment of ${amountFormatted} on ${paymentDate}.\n\nReason: ${reason}\n\nView details and submit again if needed:\n${link}`;

    await this.send(email, subject, body, 'payment-rejected');
  }

  async sendLoanActivatedEmail(
    email: string,
    organisationName: string,
    principalFormatted: string,
    link: string,
  ): Promise<void> {
    const subject = `Loan activated — ${organisationName}`;
    const body = `${organisationName} activated your loan for ${principalFormatted}.\n\nView your loan and await disbursement:\n${link}`;

    await this.send(email, subject, body, 'loan-activated');
  }

  async sendLoanDisbursedLenderEmail(
    email: string,
    borrowerName: string,
    amountFormatted: string,
    link: string,
  ): Promise<void> {
    const subject = `Loan disbursed — ${borrowerName}`;
    const body = `You disbursed ${amountFormatted} to ${borrowerName}.\n\nView the loan:\n${link}`;

    await this.send(email, subject, body, 'loan-disbursed-lender');
  }

  async sendLoanDisbursedBorrowerEmail(
    email: string,
    organisationName: string,
    amountFormatted: string,
    link: string,
  ): Promise<void> {
    const subject = `Funds received — ${organisationName}`;
    const body = `${organisationName} disbursed ${amountFormatted} to your account.\n\nView your loan:\n${link}`;

    await this.send(email, subject, body, 'loan-disbursed-borrower');
  }

  async sendLoanAgreementSentEmail(
    email: string,
    organisationName: string,
    principalFormatted: string,
    link: string,
  ): Promise<void> {
    const subject = `Sign your loan agreement — ${organisationName}`;
    const body = `${organisationName} sent you a loan agreement for ${principalFormatted}.\n\nReview and sign here:\n${link}`;

    await this.send(email, subject, body, 'loan-agreement-sent');
  }

  async sendLoanAgreementSignedEmail(
    email: string,
    borrowerName: string,
    principalFormatted: string,
    link: string,
  ): Promise<void> {
    const subject = `Loan agreement signed — ${borrowerName}`;
    const body = `${borrowerName} signed the loan agreement for ${principalFormatted}.\n\nYou can disburse funds here:\n${link}`;

    await this.send(email, subject, body, 'loan-agreement-signed');
  }

  async sendWalletRepaymentReceivedEmail(
    email: string,
    borrowerName: string,
    amountFormatted: string,
    paymentDate: string,
    link: string,
  ): Promise<void> {
    const subject = `Wallet repayment received — ${borrowerName}`;
    const body = `${borrowerName} paid ${amountFormatted} from their LMS wallet on ${paymentDate}.\n\nView the loan:\n${link}`;

    await this.send(email, subject, body, 'wallet-repayment-received');
  }

  async sendPlatformSupportNewTicketToAdmins(input: {
    adminEmails: string[];
    ticketNumber: number;
    categoryLabel: string;
    subject: string;
    description: string;
    reporterName: string;
    reporterEmail: string;
    reporterType: string;
    organisationName: string | null;
    link: string;
  }): Promise<void> {
    if (input.adminEmails.length === 0) {
      this.logger.warn(
        `[platform-support] No PLATFORM_ADMIN_EMAILS configured — skipping new ticket #${input.ticketNumber} email`,
      );
      return;
    }

    const orgLine = input.organisationName
      ? `Organisation: ${input.organisationName}\n`
      : '';
    const emailSubject = `[LMS #${input.ticketNumber}] ${input.subject}`;
    const body = `A new platform support ticket was submitted.\n\nTicket: #${input.ticketNumber}\nCategory: ${input.categoryLabel}\nSubject: ${input.subject}\nFrom: ${input.reporterName} <${input.reporterEmail}> (${input.reporterType})\n${orgLine}\nMessage:\n${input.description}\n\nReview in LMS:\n${input.link}`;

    await Promise.all(
      input.adminEmails.map((email) =>
        this.send(email, emailSubject, body, 'platform-support-new'),
      ),
    );
  }

  async sendPlatformSupportReplyToUser(input: {
    email: string;
    ticketNumber: number;
    subject: string;
    message: string;
    link: string;
  }): Promise<void> {
    const emailSubject = `Update on your LMS support ticket #${input.ticketNumber}`;
    const body = `LMS support replied to your ticket "${input.subject}".\n\n${input.message}\n\nView the conversation:\n${input.link}`;

    await this.send(input.email, emailSubject, body, 'platform-support-reply');
  }

  async sendPlatformSupportUserReplyToAdmins(input: {
    adminEmails: string[];
    ticketNumber: number;
    subject: string;
    reporterName: string;
    reporterEmail: string;
    message: string;
    link: string;
  }): Promise<void> {
    if (input.adminEmails.length === 0) {
      return;
    }

    const emailSubject = `[LMS #${input.ticketNumber}] User reply — ${input.subject}`;
    const body = `${input.reporterName} <${input.reporterEmail}> replied on ticket #${input.ticketNumber}.\n\n${input.message}\n\nReview in LMS:\n${input.link}`;

    await Promise.all(
      input.adminEmails.map((email) =>
        this.send(email, emailSubject, body, 'platform-support-user-reply'),
      ),
    );
  }

  private async send(
    to: string,
    subject: string,
    body: string,
    type: string,
    options?: SendOptions,
  ): Promise<void> {
    if (!isBrevoConfigured()) {
      const preview = `[DEV EMAIL - ${type}] To: ${to}\nSubject: ${subject}\n${body}`;
      if (options?.required) {
        throw new ServiceUnavailableException(
          'Email delivery is not configured (BREVO_API_KEY and BREVO_FROM_EMAIL required).',
        );
      }
      this.logger.warn(preview);
      return;
    }

    const env = getEnv();
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: env.BREVO_FROM_EMAIL,
          name: env.BREVO_FROM_NAME,
        },
        to: [{ email: to }],
        subject,
        textContent: body,
        tags: [type],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`Brevo error (${type} → ${to}): ${response.status} ${detail}`);
      if (options?.required) {
        throw new ServiceUnavailableException(this.brevoFailureMessage(response.status));
      }
      return;
    }

    const result = (await response.json()) as { messageId?: string };
    this.logger.log(
      `Brevo sent ${type} to ${to}${result.messageId ? ` (messageId=${result.messageId})` : ''}`,
    );
  }

  private brevoFailureMessage(status: number): string {
    if (status === 401) {
      return 'Could not send verification email: Brevo rejected the API key. Check BREVO_API_KEY and disable authorized IP restriction in Brevo → Security → Authorized IPs.';
    }
    if (status === 400) {
      return 'Could not send verification email: Brevo rejected the sender. Verify BREVO_FROM_EMAIL in Brevo → Senders & IP.';
    }
    return 'Could not send verification email. Please try again in a few minutes.';
  }
}
