import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { listAuditLogsQuerySchema, UserRole } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LenderGuard } from '../common/guards/account-type.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, LenderGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listAuditLogsQuerySchema))
    query: Parameters<AuditService['list']>[2],
  ) {
    return this.auditService.list(user.orgId!, user.sub, query);
  }
}
