import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  platformSupportTicketReplySchema,
  platformSupportTicketReviewSchema,
  type PlatformSupportTicketReplyInput,
  type PlatformSupportTicketReviewInput,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PlatformSupportService } from './platform-support.service';

@Controller('platform/support')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformSupportAdminController {
  constructor(private readonly platformSupportService: PlatformSupportService) {}

  @Get('overview')
  getOverview() {
    return this.platformSupportService.getOverview();
  }

  @Get('tickets')
  listTickets() {
    return this.platformSupportService.listAllTickets();
  }

  @Get('tickets/:id')
  getTicket(@Param('id') ticketId: string) {
    return this.platformSupportService.getTicketForAdmin(ticketId);
  }

  @Patch('tickets/:id')
  reviewTicket(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') ticketId: string,
    @Body(new ZodValidationPipe(platformSupportTicketReviewSchema))
    body: PlatformSupportTicketReviewInput,
  ) {
    return this.platformSupportService.reviewTicket(
      ticketId,
      user.sub,
      user.email,
      body,
    );
  }

  @Post('tickets/:id/messages')
  replyToTicket(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') ticketId: string,
    @Body(new ZodValidationPipe(platformSupportTicketReplySchema))
    body: PlatformSupportTicketReplyInput,
  ) {
    return this.platformSupportService.addAdminMessage(ticketId, user.sub, body);
  }
}
