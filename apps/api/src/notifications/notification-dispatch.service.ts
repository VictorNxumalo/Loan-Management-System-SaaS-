import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { NotificationJobData } from '@lms/types';
import { NotificationType, UserRole } from '@lms/types';
import { computeDaysOverdue } from '@lms/utils';
import { EmailService } from '../email/email.service';
import { formatCents } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { SmsService } from '../sms/sms.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationDispatchService implements OnModuleInit {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.queueService.registerNotificationHandler((data) => this.processJob(data));
  }

  async enqueue(data: NotificationJobData): Promise<void> {
    const queued = await this.queueService.enqueueNotification(data);
    if (!queued) {
      await this.processJob(data);
    }
  }

  async processJob(data: NotificationJobData): Promise<void> {
    switch (data.eventType) {
      case NotificationType.APPLICATION_SUBMITTED:
        await this.processApplicationSubmitted(data);
        break;
      case NotificationType.APPLICATION_APPROVED:
      case NotificationType.APPLICATION_REJECTED:
        await this.processApplicationDecision(data);
        break;
      case NotificationType.REPAYMENT_REMINDER:
        await this.processRepaymentReminder(data);
        break;
      case NotificationType.LOAN_OVERDUE:
        await this.processLoanOverdue(data);
        break;
      case NotificationType.PAYMENT_SUBMITTED:
        await this.processPaymentSubmitted(data);
        break;
      default:
        this.logger.warn(`Unknown notification event: ${(data as NotificationJobData).eventType}`);
    }
  }

  async notifyApplicationSubmitted(input: {
    orgId: string;
    applicationId: string;
    borrowerName: string;
    principalCents: number;
  }) {
    await this.enqueue({
      eventType: NotificationType.APPLICATION_SUBMITTED,
      dedupKey: `application-submitted:${input.applicationId}`,
      orgId: input.orgId,
      applicationId: input.applicationId,
      borrowerName: input.borrowerName,
      principalFormatted: formatCents(input.principalCents),
    });
  }

  async notifyApplicationApproved(input: {
    orgId: string;
    applicationId: string;
    borrowerUserId: string;
    organisationName: string;
    principalCents: number;
  }) {
    await this.enqueue({
      eventType: NotificationType.APPLICATION_APPROVED,
      dedupKey: `application-approved:${input.applicationId}`,
      orgId: input.orgId,
      applicationId: input.applicationId,
      borrowerUserId: input.borrowerUserId,
      organisationName: input.organisationName,
      principalFormatted: formatCents(input.principalCents),
    });
  }

  async notifyApplicationRejected(input: {
    orgId: string;
    applicationId: string;
    borrowerUserId: string;
    organisationName: string;
    principalCents: number;
    lenderNotes: string;
  }) {
    await this.enqueue({
      eventType: NotificationType.APPLICATION_REJECTED,
      dedupKey: `application-rejected:${input.applicationId}`,
      orgId: input.orgId,
      applicationId: input.applicationId,
      borrowerUserId: input.borrowerUserId,
      organisationName: input.organisationName,
      principalFormatted: formatCents(input.principalCents),
      lenderNotes: input.lenderNotes,
    });
  }

  async notifyRepaymentReminder(input: {
    orgId: string;
    loanId: string;
    borrowerUserId: string;
    organisationName: string;
    dueDate: string;
    amountCents: number;
    periodNumber: number;
  }) {
    await this.enqueue({
      eventType: NotificationType.REPAYMENT_REMINDER,
      dedupKey: `repayment-reminder:${input.loanId}:${input.periodNumber}:${input.dueDate}`,
      orgId: input.orgId,
      loanId: input.loanId,
      borrowerUserId: input.borrowerUserId,
      organisationName: input.organisationName,
      dueDate: input.dueDate,
      amountFormatted: formatCents(input.amountCents),
      periodNumber: input.periodNumber,
    });
  }

  async notifyPaymentSubmitted(input: {
    orgId: string;
    paymentSubmissionId: string;
    loanId: string;
    borrowerName: string;
    amountCents: number;
    paymentDate: string;
  }) {
    await this.enqueue({
      eventType: NotificationType.PAYMENT_SUBMITTED,
      dedupKey: `payment-submitted:${input.paymentSubmissionId}`,
      orgId: input.orgId,
      paymentSubmissionId: input.paymentSubmissionId,
      loanId: input.loanId,
      borrowerName: input.borrowerName,
      amountFormatted: formatCents(input.amountCents),
      paymentDate: input.paymentDate,
    });
  }

  async notifyLoanOverdue(input: {
    orgId: string;
    loanId: string;
    borrowerName: string;
    daysOverdue: number;
    outstandingCents: number;
  }) {
    await this.enqueue({
      eventType: NotificationType.LOAN_OVERDUE,
      dedupKey: `loan-overdue:${input.loanId}:${new Date().toISOString().slice(0, 10)}`,
      orgId: input.orgId,
      loanId: input.loanId,
      borrowerName: input.borrowerName,
      daysOverdue: input.daysOverdue,
      outstandingFormatted: formatCents(input.outstandingCents),
    });
  }

  private async processApplicationSubmitted(
    data: Extract<NotificationJobData, { eventType: typeof NotificationType.APPLICATION_SUBMITTED }>,
  ) {
    const recipients = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findMany({
        where: {
          orgId: data.orgId,
          deletedAt: null,
          isActive: true,
          role: { in: [UserRole.ADMIN, UserRole.LOAN_OFFICER] },
        },
        select: { id: true, email: true },
      }),
    );

    const link = this.notificationsService.appUrl(
      `/dashboard/applications/${data.applicationId}`,
    );
    const title = 'New loan application';
    const body = `${data.borrowerName} submitted an application for ${data.principalFormatted}.`;

    for (const recipient of recipients) {
      const dedupKey = `${data.dedupKey}:user:${recipient.id}`;

      await this.notificationsService.createInApp({
        orgId: data.orgId,
        userId: recipient.id,
        type: NotificationType.APPLICATION_SUBMITTED,
        title,
        body,
        dedupKey,
        relatedEntityType: 'LOAN_APPLICATION',
        relatedEntityId: data.applicationId,
      });

      await this.emailService.sendApplicationSubmittedEmail(
        recipient.email,
        data.borrowerName,
        data.principalFormatted,
        link,
      );
    }
  }

  private async processApplicationDecision(
    data: Extract<
      NotificationJobData,
      {
        eventType:
          | typeof NotificationType.APPLICATION_APPROVED
          | typeof NotificationType.APPLICATION_REJECTED;
      }
    >,
  ) {
    const borrower = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findUnique({
        where: { id: data.borrowerUserId },
        include: { borrowerAccount: true },
      }),
    );

    if (!borrower) {
      return;
    }

    const link = this.notificationsService.appUrl(
      `/borrower/applications/${data.applicationId}`,
    );
    const approved = data.eventType === NotificationType.APPLICATION_APPROVED;
    const title = approved ? 'Application approved' : 'Application declined';
    const body = approved
      ? `${data.organisationName} approved your application for ${data.principalFormatted}.`
      : `${data.organisationName} declined your application for ${data.principalFormatted}.`;

    await this.notificationsService.createInApp({
      orgId: data.orgId,
      userId: data.borrowerUserId,
      type: data.eventType,
      title,
      body,
      dedupKey: data.dedupKey,
      relatedEntityType: 'LOAN_APPLICATION',
      relatedEntityId: data.applicationId,
    });

    if (approved) {
      await this.emailService.sendApplicationApprovedEmail(
        borrower.email,
        data.organisationName,
        data.principalFormatted,
        link,
      );
    } else {
      await this.emailService.sendApplicationRejectedEmail(
        borrower.email,
        data.organisationName,
        data.principalFormatted,
        data.lenderNotes ?? 'No reason provided',
        link,
      );
    }

    const phone = borrower.borrowerAccount?.phone;
    if (phone) {
      const smsBody = approved
        ? `${data.organisationName} approved your LMS loan application for ${data.principalFormatted}.`
        : `${data.organisationName} declined your LMS loan application. Check the app for details.`;
      await this.smsService.send(phone, smsBody, data.eventType);
    }
  }

  private async processRepaymentReminder(
    data: Extract<NotificationJobData, { eventType: typeof NotificationType.REPAYMENT_REMINDER }>,
  ) {
    const borrower = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findUnique({
        where: { id: data.borrowerUserId },
        include: { borrowerAccount: true },
      }),
    );

    if (!borrower) {
      return;
    }

    const link = this.notificationsService.appUrl(`/borrower/loans/${data.loanId}`);
    const title = 'Repayment due soon';
    const body = `Your payment of ${data.amountFormatted} to ${data.organisationName} is due on ${data.dueDate}.`;

    await this.notificationsService.createInApp({
      orgId: data.orgId,
      userId: data.borrowerUserId,
      type: NotificationType.REPAYMENT_REMINDER,
      title,
      body,
      dedupKey: data.dedupKey,
      relatedEntityType: 'LOAN',
      relatedEntityId: data.loanId,
    });

    await this.emailService.sendRepaymentReminderEmail(
      borrower.email,
      data.organisationName,
      data.dueDate,
      data.amountFormatted,
      link,
    );

    const phone = borrower.borrowerAccount?.phone;
    if (phone) {
      await this.smsService.send(
        phone,
        `LMS reminder: ${data.amountFormatted} due to ${data.organisationName} on ${data.dueDate}.`,
        NotificationType.REPAYMENT_REMINDER,
      );
    }
  }

  private async processLoanOverdue(
    data: Extract<NotificationJobData, { eventType: typeof NotificationType.LOAN_OVERDUE }>,
  ) {
    const recipients = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findMany({
        where: {
          orgId: data.orgId,
          deletedAt: null,
          isActive: true,
          role: { in: [UserRole.ADMIN, UserRole.LOAN_OFFICER] },
        },
        select: { id: true, email: true },
      }),
    );

    const link = this.notificationsService.appUrl(`/dashboard/loans/${data.loanId}`);
    const title = 'Loan overdue';
    const body = `${data.borrowerName}'s loan is ${data.daysOverdue} day(s) overdue (${data.outstandingFormatted} outstanding).`;

    for (const recipient of recipients) {
      const dedupKey = `${data.dedupKey}:user:${recipient.id}`;

      await this.notificationsService.createInApp({
        orgId: data.orgId,
        userId: recipient.id,
        type: NotificationType.LOAN_OVERDUE,
        title,
        body,
        dedupKey,
        relatedEntityType: 'LOAN',
        relatedEntityId: data.loanId,
      });

      await this.emailService.sendLoanOverdueEmail(
        recipient.email,
        data.borrowerName,
        data.daysOverdue,
        data.outstandingFormatted,
        link,
      );
    }
  }

  private async processPaymentSubmitted(
    data: Extract<NotificationJobData, { eventType: typeof NotificationType.PAYMENT_SUBMITTED }>,
  ) {
    const recipients = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findMany({
        where: {
          orgId: data.orgId,
          deletedAt: null,
          isActive: true,
          role: { in: [UserRole.ADMIN, UserRole.LOAN_OFFICER] },
        },
        select: { id: true, email: true },
      }),
    );

    const link = this.notificationsService.appUrl(
      `/dashboard/payment-submissions/${data.paymentSubmissionId}`,
    );
    const title = 'Borrower payment submitted';
    const body = `${data.borrowerName} reported a payment of ${data.amountFormatted} on ${data.paymentDate}. Review proof and record it.`;

    for (const recipient of recipients) {
      const dedupKey = `${data.dedupKey}:user:${recipient.id}`;

      await this.notificationsService.createInApp({
        orgId: data.orgId,
        userId: recipient.id,
        type: NotificationType.PAYMENT_SUBMITTED,
        title,
        body,
        dedupKey,
        relatedEntityType: 'PAYMENT_SUBMISSION',
        relatedEntityId: data.paymentSubmissionId,
      });

      await this.emailService.sendPaymentSubmittedEmail(
        recipient.email,
        data.borrowerName,
        data.amountFormatted,
        data.paymentDate,
        link,
      );
    }
  }
}
