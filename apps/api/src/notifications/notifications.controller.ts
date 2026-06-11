import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { listNotificationsQuerySchema } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listNotificationsQuerySchema))
    query: Parameters<NotificationsService['list']>[2],
  ) {
    return this.notificationsService.list(user.sub, user.orgId, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AccessTokenPayload) {
    return this.notificationsService.unreadCount(user.sub, user.orgId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AccessTokenPayload) {
    return this.notificationsService.markAllRead(user.sub, user.orgId);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.notificationsService.markRead(user.sub, user.orgId, id);
  }
}
