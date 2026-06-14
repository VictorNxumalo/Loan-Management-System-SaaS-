import { Injectable, Logger } from '@nestjs/common';
import type { ListAuditLogsQuery, PaginatedAuditLogsDto } from '@lms/types';
import { PrismaService, type PrismaTx } from '../prisma/prisma.service';
import { presentAuditLogEntry } from './audit-presenter';

export interface AuditEntry {
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an audit entry inside an existing org-scoped transaction.
   * Failures are logged but never break the business operation.
   */
  async record(tx: PrismaTx, entry: AuditEntry): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          orgId: entry.orgId,
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          beforeState: entry.before === undefined ? undefined : (entry.before as object),
          afterState: entry.after === undefined ? undefined : (entry.after as object),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit write failed for ${entry.action} ${entry.entityType}/${entry.entityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async list(
    orgId: string,
    userId: string,
    query: ListAuditLogsQuery,
  ): Promise<PaginatedAuditLogsDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const where = {
        orgId,
        ...(query.entityType ? { entityType: query.entityType } : {}),
      };

      const skip = (query.page - 1) * query.limit;

      const [total, rows] = await Promise.all([
        tx.auditLog.count({ where }),
        tx.auditLog.findMany({
          where,
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
      ]);

      return {
        items: rows.map((row) => {
          const presented = presentAuditLogEntry({
            action: row.action,
            entityType: row.entityType,
            entityId: row.entityId,
            beforeState: row.beforeState,
            afterState: row.afterState,
          });

          return {
            id: row.id,
            userName: row.user.name,
            userEmail: row.user.email,
            action: row.action,
            entityType: row.entityType,
            entityId: row.entityId,
            beforeState: row.beforeState,
            afterState: row.afterState,
            createdAt: row.createdAt.toISOString(),
            summary: presented.summary,
            subjectLabel: presented.subjectLabel,
            details: presented.details,
          };
        }),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      };
    });
  }
}
