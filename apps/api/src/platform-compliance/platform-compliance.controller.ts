import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  platformVerificationReviewSchema,
  type PlatformVerificationReviewInput,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PlatformComplianceService } from './platform-compliance.service';

@Controller('platform/compliance')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformComplianceController {
  constructor(private readonly platformComplianceService: PlatformComplianceService) {}

  @Get('lenders')
  listLenders() {
    return this.platformComplianceService.listLenders();
  }

  @Patch('lenders/:orgId/verification')
  reviewVerification(
    @CurrentUser() user: AccessTokenPayload,
    @Param('orgId') orgId: string,
    @Body(new ZodValidationPipe(platformVerificationReviewSchema))
    body: PlatformVerificationReviewInput,
  ) {
    return this.platformComplianceService.reviewVerification(
      orgId,
      user.email,
      user.sub,
      body,
    );
  }
}
