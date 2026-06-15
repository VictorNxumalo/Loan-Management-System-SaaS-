import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ListNotificationsQuery,
  NotificationDto,
  PaginatedNotificationsDto,
  UnreadNotificationCountDto,
} from '@lms/types';
import { getEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationRealtimeService } from './notification-realtime.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: NotificationRealtimeService,
  ) {}

  async list(
    userId: string,
    orgId: string | null | undefined,
    query: ListNotificationsQuery,
  ): Promise<PaginatedNotificationsDto> {
    const skip = (query.page - 1) * query.limit;
    const where = {
      userId,
    };

    const run = async (tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0]) => {
      const [total, unreadCount, rows] = await Promise.all([
        tx.notification.count({ where }),
        tx.notification.count({ where: { userId, readAt: null } }),
        tx.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
      ]);

      return {
        items: rows.map((row) => this.mapRow(row)),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
        unreadCount,
      };
    };

    if (orgId) {
      return this.prisma.withOrgContext(orgId, userId, run);
    }

    return this.prisma.withUserContext(userId, null, run);
  }

  async unreadCount(
    userId: string,
    orgId: string | null | undefined,
  ): Promise<UnreadNotificationCountDto> {
    const run = async (tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0]) => {
      const unreadCount = await tx.notification.count({
        where: { userId, readAt: null },
      });
      return { unreadCount };
    };

    if (orgId) {
      return this.prisma.withOrgContext(orgId, userId, run);
    }

    return this.prisma.withUserContext(userId, null, run);
  }

  async markRead(userId: string, orgId: string | null | undefined, id: string) {
    const run = async (tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0]) => {
      const row = await tx.notification.findFirst({
        where: { id, userId },
      });

      if (!row) {
        throw new NotFoundException('Notification not found');
      }

      if (!row.readAt) {
        await tx.notification.update({
          where: { id },
          data: { readAt: new Date() },
        });
      }

      return { message: 'Notification marked as read' };
    };

    if (orgId) {
      return this.prisma.withOrgContext(orgId, userId, run);
    }

    return this.prisma.withUserContext(userId, null, run);
  }

  async markAllRead(userId: string, orgId: string | null | undefined) {
    const run = async (tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0]) => {
      await tx.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      return { message: 'All notifications marked as read' };
    };

    if (orgId) {
      return this.prisma.withOrgContext(orgId, userId, run);
    }

    return this.prisma.withUserContext(userId, null, run);
  }

  async createInApp(input: {
    orgId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    dedupKey: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<NotificationDto | null> {
    try {
      const result = await this.prisma.withAuthLookup(async (tx) => {
        const row = await tx.notification.create({
          data: {
            orgId: input.orgId,
            userId: input.userId,
            type: input.type,
            title: input.title,
            body: input.body,
            dedupKey: input.dedupKey,
            relatedEntityType: input.relatedEntityType ?? null,
            relatedEntityId: input.relatedEntityId ?? null,
          },
        });
        const unreadCount = await tx.notification.count({
          where: { userId: input.userId, readAt: null },
        });
        return { row, unreadCount };
      });

      const dto = this.mapRow(result.row);
      this.realtime.publish(input.userId, {
        notification: dto,
        unreadCount: result.unreadCount,
      });
      return dto;
    } catch {
      return null;
    }
  }

  appUrl(path: string): string {
    return `${getEnv().NEXTAUTH_URL}${path}`;
  }

  private mapRow(row: {
    id: string;
    orgId: string;
    type: string;
    title: string;
    body: string;
    readAt: Date | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: row.id,
      orgId: row.orgId,
      type: row.type,
      title: row.title,
      body: row.body,
      readAt: row.readAt?.toISOString() ?? null,
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
