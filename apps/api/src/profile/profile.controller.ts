import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  borrowerOnboardingSchema,
  lenderOnboardingSchema,
  requestKycDocumentUploadSchema,
  updateProfileSchema,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BorrowerGuard, LenderGuard } from '../common/guards/account-type.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ProfileService } from './profile.service';

@Controller('auth/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: AccessTokenPayload) {
    return this.profileService.getProfile(user.sub, user.accountType, user.orgId ?? undefined);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(updateProfileSchema))
    body: Parameters<ProfileService['updateProfile']>[3],
  ) {
    return this.profileService.updateProfile(
      user.sub,
      user.accountType,
      user.orgId ?? undefined,
      body,
    );
  }

  @Post('id-document/upload-url')
  requestIdDocumentUpload(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(requestKycDocumentUploadSchema))
    body: Parameters<ProfileService['requestIdDocumentUploadUrl']>[3],
  ) {
    return this.profileService.requestIdDocumentUploadUrl(
      user.sub,
      user.accountType,
      user.orgId ?? undefined,
      body,
    );
  }

  @Get('id-document/download-url')
  idDocumentDownload(@CurrentUser() user: AccessTokenPayload) {
    return this.profileService.getIdDocumentDownloadUrl(
      user.sub,
      user.accountType,
      user.orgId ?? undefined,
    );
  }
}

@Controller('auth')
export class ProfileOnboardingController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch('onboarding')
  @UseGuards(JwtAuthGuard, LenderGuard)
  completeLenderOnboarding(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(lenderOnboardingSchema))
    body: Parameters<ProfileService['completeLenderOnboarding']>[2],
  ) {
    return this.profileService.completeLenderOnboarding(user.sub, user.orgId!, body);
  }

  @Patch('borrower-onboarding')
  @UseGuards(JwtAuthGuard, BorrowerGuard)
  completeBorrowerOnboarding(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(borrowerOnboardingSchema))
    body: Parameters<ProfileService['completeBorrowerOnboarding']>[1],
  ) {
    return this.profileService.completeBorrowerOnboarding(user.sub, body);
  }
}
