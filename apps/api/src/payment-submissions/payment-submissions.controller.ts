import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createPaymentSubmissionSchema,
  rejectPaymentSubmissionSchema,
  requestPaymentProofUploadSchema,
  UserRole,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BorrowerGuard, LenderGuard } from '../common/guards/account-type.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PaymentSubmissionsService } from './payment-submissions.service';

@Controller('borrower/loans/:loanId/payment-submissions')
@UseGuards(JwtAuthGuard, BorrowerGuard)
export class BorrowerPaymentSubmissionsController {
  constructor(private readonly paymentSubmissions: PaymentSubmissionsService) {}

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('loanId') loanId: string,
    @Body(new ZodValidationPipe(createPaymentSubmissionSchema))
    body: Parameters<PaymentSubmissionsService['createForBorrower']>[2],
  ) {
    return this.paymentSubmissions.createForBorrower(user.sub, loanId, body);
  }

  @Post(':submissionId/proof/upload-url')
  requestProofUpload(
    @CurrentUser() user: AccessTokenPayload,
    @Param('loanId') loanId: string,
    @Param('submissionId') submissionId: string,
    @Body(new ZodValidationPipe(requestPaymentProofUploadSchema))
    body: Parameters<PaymentSubmissionsService['requestProofUpload']>[3],
  ) {
    return this.paymentSubmissions.requestProofUpload(
      user.sub,
      loanId,
      submissionId,
      body,
    );
  }

  @Post(':submissionId/submit')
  submit(
    @CurrentUser() user: AccessTokenPayload,
    @Param('loanId') loanId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.paymentSubmissions.submitToLender(user.sub, loanId, submissionId);
  }

  @Get(':submissionId/proof/download-url')
  proofDownload(
    @CurrentUser() user: AccessTokenPayload,
    @Param('loanId') loanId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.paymentSubmissions.getProofDownloadForBorrower(
      user.sub,
      loanId,
      submissionId,
    );
  }
}

@Controller('payment-submissions')
@UseGuards(JwtAuthGuard, LenderGuard, PlanGuard, RolesGuard)
export class LenderPaymentSubmissionsController {
  constructor(private readonly paymentSubmissions: PaymentSubmissionsService) {}

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.paymentSubmissions.getForLender(user.orgId!, user.sub, id);
  }

  @Get(':id/proof/download-url')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  proofDownload(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.paymentSubmissions.getProofDownloadForLender(user.orgId!, user.sub, id);
  }

  @Post(':id/confirm')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  confirm(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.paymentSubmissions.confirm(user.orgId!, user.sub, id);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  reject(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectPaymentSubmissionSchema))
    body: Parameters<PaymentSubmissionsService['reject']>[3],
  ) {
    return this.paymentSubmissions.reject(user.orgId!, user.sub, id, body);
  }
}
