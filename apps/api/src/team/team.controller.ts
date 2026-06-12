import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { sendTeamInviteSchema, UserRole } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LenderGuard } from '../common/guards/account-type.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TeamService } from './team.service';

@Controller('team')
@UseGuards(JwtAuthGuard, LenderGuard, PlanGuard, RolesGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  listTeam(@CurrentUser() user: AccessTokenPayload) {
    return this.teamService.listTeam(user.orgId!, user.sub);
  }

  @Post('invite')
  @Roles(UserRole.ADMIN)
  sendInvite(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(sendTeamInviteSchema))
    body: Parameters<TeamService['sendInvite']>[2],
  ) {
    return this.teamService.sendInvite(user.orgId!, user.sub, body);
  }

  @Delete('invites/:id')
  @Roles(UserRole.ADMIN)
  revokeInvite(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.teamService.revokeInvite(user.orgId!, user.sub, id);
  }

  @Delete(':userId')
  @Roles(UserRole.ADMIN)
  removeMember(
    @CurrentUser() user: AccessTokenPayload,
    @Param('userId') userId: string,
  ) {
    return this.teamService.removeMember(user.orgId!, user.sub, userId);
  }
}
