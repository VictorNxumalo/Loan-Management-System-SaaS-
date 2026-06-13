import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { organisationLogoUploadSchema, organisationSettingsSchema } from '@lms/types';
import { UserRole } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { BorrowerGuard, LenderGuard } from '../common/guards/account-type.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';
import { BorrowerLendingConstraintsService } from './borrower-lending-constraints.service';
import {
  BorrowerPortalService,
  LenderSettingsService,
} from './borrower-portal.service';

const inviteSchema = z.object({
  email: z.string().email(),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

@Controller('borrower')
@UseGuards(JwtAuthGuard, BorrowerGuard)
export class BorrowerPortalController {
  constructor(
    private readonly borrowerPortalService: BorrowerPortalService,
    private readonly lendingConstraints: BorrowerLendingConstraintsService,
  ) {}

  @Get('lending-status')
  lendingStatus(@CurrentUser() user: AccessTokenPayload) {
    return this.lendingConstraints.getStatus(user.sub);
  }

  @Get('lenders')
  listMyLenders(@CurrentUser() user: AccessTokenPayload) {
    return this.borrowerPortalService.listMyLenders(user.sub);
  }

  @Post('lenders/:orgId/connect')
  connectPublic(
    @CurrentUser() user: AccessTokenPayload,
    @Param('orgId') orgId: string,
  ) {
    return this.borrowerPortalService.connectToPublicLender(user.sub, orgId);
  }

  @Post('invites/accept')
  acceptInvite(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: { token: string },
  ) {
    return this.borrowerPortalService.acceptInvite(user.sub, body.token);
  }
}

@Controller('settings')
@UseGuards(JwtAuthGuard, LenderGuard, PlanGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly lenderSettingsService: LenderSettingsService) {}

  @Post('organisation/logo/upload-url')
  @Roles(UserRole.ADMIN)
  requestLogoUploadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(organisationLogoUploadSchema))
    body: Parameters<LenderSettingsService['requestLogoUploadUrl']>[2],
  ) {
    return this.lenderSettingsService.requestLogoUploadUrl(user.orgId!, user.sub, body);
  }

  @Patch('organisation')
  @Roles(UserRole.ADMIN)
  updateOrganisation(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(organisationSettingsSchema))
    body: Parameters<LenderSettingsService['updateOrganisationSettings']>[2],
  ) {
    return this.lenderSettingsService.updateOrganisationSettings(
      user.orgId!,
      user.sub,
      body,
    );
  }

  @Post('invites')
  @Roles(UserRole.ADMIN)
  sendInvite(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(inviteSchema)) body: { email: string },
  ) {
    return this.lenderSettingsService.sendBorrowerInvite(
      user.orgId!,
      user.sub,
      body.email,
    );
  }
}
