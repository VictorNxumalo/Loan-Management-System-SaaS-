import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { createCheckoutSessionSchema, UserRole } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LenderGuard } from '../common/guards/account-type.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard, LenderGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('status')
  @Roles(UserRole.ADMIN)
  getStatus(@CurrentUser() user: AccessTokenPayload) {
    return this.billingService.getStatus(user.orgId!, user.sub);
  }

  @Post('checkout')
  @Roles(UserRole.ADMIN)
  createCheckout(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createCheckoutSessionSchema))
    body: Parameters<BillingService['createCheckoutSession']>[3],
  ) {
    return this.billingService.createCheckoutSession(
      user.orgId!,
      user.sub,
      user.email,
      body,
    );
  }

  @Get('portal-url')
  @Roles(UserRole.ADMIN)
  getPortalUrl(@CurrentUser() user: AccessTokenPayload) {
    return this.billingService.createPortalSession(user.orgId!, user.sub);
  }
}
