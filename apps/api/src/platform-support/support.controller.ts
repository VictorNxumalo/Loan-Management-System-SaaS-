import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  addSupportTicketMessageSchema,
  createSupportTicketSchema,
  type AddSupportTicketMessageInput,
  type CreateSupportTicketInput,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AccountType } from '@prisma/client';
import { PlatformSupportService } from './platform-support.service';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly platformSupportService: PlatformSupportService) {}

  @Post('tickets')
  createTicket(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createSupportTicketSchema))
    body: CreateSupportTicketInput,
  ) {
    return this.platformSupportService.createTicket(
      user.sub,
      user.accountType as AccountType,
      user.orgId,
      body,
    );
  }

  @Get('tickets')
  listMyTickets(@CurrentUser() user: AccessTokenPayload) {
    return this.platformSupportService.listMyTickets(user.sub);
  }

  @Get('tickets/:id')
  getMyTicket(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') ticketId: string,
  ) {
    return this.platformSupportService.getMyTicket(user.sub, ticketId);
  }

  @Post('tickets/:id/messages')
  addMessage(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') ticketId: string,
    @Body(new ZodValidationPipe(addSupportTicketMessageSchema))
    body: AddSupportTicketMessageInput,
  ) {
    return this.platformSupportService.addUserMessage(user.sub, ticketId, body);
  }
}
