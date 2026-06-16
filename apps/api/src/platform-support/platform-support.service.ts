import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AddSupportTicketMessageInput,
  CreateSupportTicketInput,
  PlatformSupportOverviewDto,
  PlatformSupportTicketReplyInput,
  PlatformSupportTicketReviewInput,
  SupportTicketDetailDto,
  SupportTicketSummaryDto,
} from '@lms/types';
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  NotificationType,
  SupportTicketReporterType,
  SupportTicketStatus,
} from '@lms/types';
import { AccountType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { getPlatformAdminEmails, getEnv } from '../config/env';
import { EmailService } from '../email/email.service';
import { isPublicListingEnabled } from '../common/organisation-settings';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type TicketWithRelations = {
  id: string;
  ticketNumber: number;
  reporterUserId: string;
  reporterType: string;
  orgId: string | null;
  category: string;
  subject: string;
  description: string;
  status: string;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reporter: { id: string; name: string; email: string };
  org: { name: string } | null;
  messages: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: Date;
    author: { name: string; email: string };
  }>;
};

@Injectable()
export class PlatformSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getOverview(): Promise<PlatformSupportOverviewDto> {
    const [openTickets, inProgressTickets, waitingOnUserTickets, orgs] =
      await Promise.all([
        this.prisma.platformSupportTicket.count({
          where: { status: SupportTicketStatus.OPEN },
        }),
        this.prisma.platformSupportTicket.count({
          where: { status: SupportTicketStatus.IN_PROGRESS },
        }),
        this.prisma.platformSupportTicket.count({
          where: { status: SupportTicketStatus.WAITING_ON_USER },
        }),
        this.prisma.organisation.findMany({
          where: { deletedAt: null },
          select: { settings: true },
        }),
      ]);

    const publicLenders = orgs.filter((org) =>
      isPublicListingEnabled((org.settings as Record<string, unknown>) ?? {}),
    ).length;

    return {
      openTickets,
      inProgressTickets,
      waitingOnUserTickets,
      totalLenders: orgs.length,
      publicLenders,
    };
  }

  async createTicket(
    userId: string,
    accountType: AccountType,
    orgId: string | undefined,
    input: CreateSupportTicketInput,
  ): Promise<SupportTicketDetailDto> {
    const reporterType =
      accountType === AccountType.BORROWER
        ? SupportTicketReporterType.BORROWER
        : SupportTicketReporterType.LENDER;

    const ticket = await this.prisma.withUserContext(userId, orgId, async (tx) => {
      const created = await tx.platformSupportTicket.create({
        data: {
          id: randomUUID(),
          reporterUserId: userId,
          reporterType,
          orgId: orgId ?? null,
          category: input.category,
          subject: input.subject.trim(),
          description: input.description.trim(),
        },
        include: this.detailInclude(),
      });

      if (orgId) {
        await this.auditService.record(tx, {
          orgId,
          userId,
          action: 'platform_support.ticket_created',
          entityType: 'PLATFORM_SUPPORT_TICKET',
          entityId: created.id,
          after: {
            ticketNumber: created.ticketNumber,
            category: created.category,
            subject: created.subject,
          },
        });
      }

      return created;
    });

    await this.notifyAdminsOfNewTicket(ticket);

    return this.mapDetail(ticket as TicketWithRelations, { includeInternal: false });
  }

  async listMyTickets(userId: string): Promise<SupportTicketSummaryDto[]> {
    const tickets = await this.prisma.withUserContext(userId, null, async (tx) =>
      tx.platformSupportTicket.findMany({
        where: { reporterUserId: userId },
        orderBy: { createdAt: 'desc' },
      }),
    );

    return tickets.map((ticket) => this.mapSummary(ticket));
  }

  async getMyTicket(userId: string, ticketId: string): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.withUserContext(userId, null, async (tx) =>
      tx.platformSupportTicket.findFirst({
        where: { id: ticketId, reporterUserId: userId },
        include: {
          ...this.detailInclude(),
          messages: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { name: true, email: true } } },
          },
        },
      }),
    );

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return this.mapDetail(ticket as TicketWithRelations, { includeInternal: false });
  }

  async addUserMessage(
    userId: string,
    ticketId: string,
    input: AddSupportTicketMessageInput,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.withUserContext(userId, null, async (tx) => {
      const existing = await tx.platformSupportTicket.findFirst({
        where: { id: ticketId, reporterUserId: userId },
      });

      if (!existing) {
        throw new NotFoundException('Support ticket not found');
      }

      if (
        existing.status === SupportTicketStatus.RESOLVED ||
        existing.status === SupportTicketStatus.CLOSED
      ) {
        throw new ForbiddenException('This ticket is closed');
      }

      await tx.platformSupportTicketMessage.create({
        data: {
          id: randomUUID(),
          ticketId,
          authorUserId: userId,
          body: input.body.trim(),
          isInternal: false,
        },
      });

      if (existing.status === SupportTicketStatus.WAITING_ON_USER) {
        await tx.platformSupportTicket.update({
          where: { id: ticketId },
          data: { status: SupportTicketStatus.IN_PROGRESS },
        });
      }

      return tx.platformSupportTicket.findFirstOrThrow({
        where: { id: ticketId },
        include: {
          ...this.detailInclude(),
          messages: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { name: true, email: true } } },
          },
        },
      });
    });

    const reporter = ticket.reporter;
    await this.emailService.sendPlatformSupportUserReplyToAdmins({
      adminEmails: getPlatformAdminEmails(),
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      reporterName: reporter.name,
      reporterEmail: reporter.email,
      message: input.body.trim(),
      link: this.adminTicketLink(ticket.id),
    });

    await this.notifyAdminsInApp({
      ticket: ticket as TicketWithRelations,
      type: NotificationType.SUPPORT_TICKET_USER_REPLIED,
      title: `Ticket #${ticket.ticketNumber} updated`,
      body: `${reporter.name} added a reply on "${ticket.subject}".`,
      dedupSuffix: `user-replied:${Date.now()}`,
    });

    return this.mapDetail(ticket as TicketWithRelations, { includeInternal: false });
  }

  async listAllTickets(): Promise<SupportTicketSummaryDto[]> {
    const tickets = await this.prisma.platformSupportTicket.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return tickets.map((ticket) => this.mapSummary(ticket));
  }

  async getTicketForAdmin(ticketId: string): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.platformSupportTicket.findUnique({
      where: { id: ticketId },
      include: {
        ...this.detailInclude(),
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true, email: true } } },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return this.mapDetail(ticket as TicketWithRelations, { includeInternal: true });
  }

  async reviewTicket(
    ticketId: string,
    adminUserId: string,
    adminEmail: string,
    input: PlatformSupportTicketReviewInput,
  ): Promise<SupportTicketDetailDto> {
    const { updatedTicket, previousStatus } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.platformSupportTicket.findUnique({
        where: { id: ticketId },
      });

      if (!existing) {
        throw new NotFoundException('Support ticket not found');
      }

      const resolvedAt =
        input.status === SupportTicketStatus.RESOLVED ||
        input.status === SupportTicketStatus.CLOSED
          ? new Date()
          : null;

      const updated = await tx.platformSupportTicket.update({
        where: { id: ticketId },
        data: {
          status: input.status,
          resolutionNote: input.resolutionNote?.trim() || null,
          resolvedAt,
        },
        include: {
          ...this.detailInclude(),
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { name: true, email: true } } },
          },
        },
      });

      if (updated.orgId) {
        await this.auditService.record(tx, {
          orgId: updated.orgId,
          userId: adminUserId,
          action: 'platform_support.ticket_reviewed',
          entityType: 'PLATFORM_SUPPORT_TICKET',
          entityId: ticketId,
          after: {
            status: input.status,
            resolutionNote: input.resolutionNote?.trim() || null,
            reviewedBy: adminEmail,
          },
        });
      }

      return {
        updatedTicket: updated,
        previousStatus: existing.status,
      };
    });

    if (previousStatus !== input.status) {
      await this.notifyReporterInApp({
        ticket: updatedTicket as TicketWithRelations,
        type: NotificationType.SUPPORT_TICKET_STATUS_UPDATED,
        title: `Ticket #${updatedTicket.ticketNumber} status updated`,
        body: `LMS updated your ticket "${updatedTicket.subject}" to ${SUPPORT_TICKET_STATUS_LABELS[input.status]}.`,
        dedupKey: `support-ticket-status:${updatedTicket.id}:${input.status}:${updatedTicket.updatedAt.getTime()}`,
      });
    }

    return this.mapDetail(updatedTicket as TicketWithRelations, { includeInternal: true });
  }

  async addAdminMessage(
    ticketId: string,
    adminUserId: string,
    input: PlatformSupportTicketReplyInput,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.platformSupportTicket.findUnique({
        where: { id: ticketId },
        include: { reporter: { select: { id: true, name: true, email: true } } },
      });

      if (!existing) {
        throw new NotFoundException('Support ticket not found');
      }

      await tx.platformSupportTicketMessage.create({
        data: {
          id: randomUUID(),
          ticketId,
          authorUserId: adminUserId,
          body: input.body.trim(),
          isInternal: input.isInternal === true,
        },
      });

      const nextStatus =
        input.isInternal === true
          ? existing.status
          : SupportTicketStatus.WAITING_ON_USER;

      const updated = await tx.platformSupportTicket.update({
        where: { id: ticketId },
        data: { status: nextStatus },
        include: {
          ...this.detailInclude(),
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { name: true, email: true } } },
          },
        },
      });

      if (input.isInternal !== true) {
        await this.emailService.sendPlatformSupportReplyToUser({
          email: existing.reporter.email,
          ticketNumber: existing.ticketNumber,
          subject: existing.subject,
          message: input.body.trim(),
          link: this.userTicketLink(existing.reporterType, ticketId),
        });
      }

      return updated;
    });

    if (input.isInternal !== true) {
      await this.notifyReporterInApp({
        ticket: ticket as TicketWithRelations,
        type: NotificationType.SUPPORT_TICKET_ADMIN_REPLIED,
        title: `LMS replied to ticket #${ticket.ticketNumber}`,
        body: `You have a new reply on "${ticket.subject}".`,
        dedupKey: `support-ticket-admin-reply:${ticket.id}:${ticket.updatedAt.getTime()}`,
      });
    }

    return this.mapDetail(ticket as TicketWithRelations, { includeInternal: true });
  }

  private async notifyAdminsOfNewTicket(ticket: TicketWithRelations) {
    await this.emailService.sendPlatformSupportNewTicketToAdmins({
      adminEmails: getPlatformAdminEmails(),
      ticketNumber: ticket.ticketNumber,
      categoryLabel:
        SUPPORT_TICKET_CATEGORY_LABELS[
          ticket.category as keyof typeof SUPPORT_TICKET_CATEGORY_LABELS
        ],
      subject: ticket.subject,
      description: ticket.description,
      reporterName: ticket.reporter.name,
      reporterEmail: ticket.reporter.email,
      reporterType: ticket.reporterType,
      organisationName: ticket.org?.name ?? null,
      link: this.adminTicketLink(ticket.id),
    });

    await this.notifyAdminsInApp({
      ticket,
      type: NotificationType.SUPPORT_TICKET_CREATED,
      title: `New support ticket #${ticket.ticketNumber}`,
      body: `${ticket.reporter.name} reported: "${ticket.subject}".`,
      dedupSuffix: 'created',
    });
  }

  private async notifyAdminsInApp(input: {
    ticket: TicketWithRelations;
    type: string;
    title: string;
    body: string;
    dedupSuffix: string;
  }) {
    const adminEmails = getPlatformAdminEmails();
    if (adminEmails.length === 0) {
      return;
    }

    const admins = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          email: { in: adminEmails },
        },
        select: { id: true, orgId: true },
      }),
    );

    for (const admin of admins) {
      const orgId = await this.resolveNotificationOrgId(
        admin.id,
        admin.orgId ?? input.ticket.orgId,
      );
      if (!orgId) {
        continue;
      }
      await this.notificationsService.createInApp({
        orgId,
        userId: admin.id,
        type: input.type,
        title: input.title,
        body: input.body,
        dedupKey: `support-ticket:${input.ticket.id}:${input.dedupSuffix}:admin:${admin.id}`,
        relatedEntityType: 'PLATFORM_SUPPORT_TICKET',
        relatedEntityId: input.ticket.id,
      });
    }
  }

  private async notifyReporterInApp(input: {
    ticket: TicketWithRelations;
    type: string;
    title: string;
    body: string;
    dedupKey: string;
  }) {
    const orgId = await this.resolveNotificationOrgId(
      input.ticket.reporterUserId,
      input.ticket.orgId,
    );
    if (!orgId) {
      return;
    }

    await this.notificationsService.createInApp({
      orgId,
      userId: input.ticket.reporterUserId,
      type: input.type,
      title: input.title,
      body: input.body,
      dedupKey: input.dedupKey,
      relatedEntityType: 'PLATFORM_SUPPORT_TICKET',
      relatedEntityId: input.ticket.id,
    });
  }

  private async resolveNotificationOrgId(
    userId: string,
    fallbackOrgId: string | null | undefined,
  ): Promise<string | null> {
    const user = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { orgId: true },
      }),
    );
    if (user?.orgId) {
      return user.orgId;
    }
    if (fallbackOrgId) {
      return fallbackOrgId;
    }

    const admin = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({
        where: {
          deletedAt: null,
          isActive: true,
          email: { in: getPlatformAdminEmails() },
          orgId: { not: null },
        },
        select: { orgId: true },
      }),
    );
    return admin?.orgId ?? null;
  }

  private detailInclude() {
    return {
      reporter: { select: { id: true, name: true, email: true } },
      org: { select: { name: true } },
      messages: {
        orderBy: { createdAt: 'asc' as const },
        include: { author: { select: { name: true, email: true } } },
      },
    };
  }

  private mapSummary(ticket: {
    id: string;
    ticketNumber: number;
    category: string;
    subject: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): SupportTicketSummaryDto {
    const category = ticket.category as keyof typeof SUPPORT_TICKET_CATEGORY_LABELS;
    const status = ticket.status as keyof typeof SUPPORT_TICKET_STATUS_LABELS;

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category,
      categoryLabel: SUPPORT_TICKET_CATEGORY_LABELS[category],
      subject: ticket.subject,
      status,
      statusLabel: SUPPORT_TICKET_STATUS_LABELS[status],
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private mapDetail(
    ticket: TicketWithRelations,
    options: { includeInternal: boolean },
  ): SupportTicketDetailDto {
    const category = ticket.category as keyof typeof SUPPORT_TICKET_CATEGORY_LABELS;
    const status = ticket.status as keyof typeof SUPPORT_TICKET_STATUS_LABELS;
    const messages = ticket.messages
      .filter((message) => options.includeInternal || !message.isInternal)
      .map((message) => ({
        id: message.id,
        authorName: message.author.name,
        authorEmail: message.author.email,
        body: message.body,
        isInternal: message.isInternal,
        createdAt: message.createdAt.toISOString(),
      }));

    return {
      ...this.mapSummary(ticket),
      description: ticket.description,
      reporterName: ticket.reporter.name,
      reporterEmail: ticket.reporter.email,
      reporterType: ticket.reporterType as SupportTicketReporterType,
      organisationName: ticket.org?.name ?? null,
      resolutionNote: ticket.resolutionNote,
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      messages,
    };
  }

  private adminTicketLink(ticketId: string): string {
    return `${getEnv().NEXTAUTH_URL}/platform/support/${ticketId}`;
  }

  private userTicketLink(reporterType: string, ticketId: string): string {
    const base = getEnv().NEXTAUTH_URL;
    if (reporterType === SupportTicketReporterType.BORROWER) {
      return `${base}/borrower/support/${ticketId}`;
    }
    return `${base}/dashboard/support/${ticketId}`;
  }
}
