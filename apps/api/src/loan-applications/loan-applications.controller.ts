import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  approveLoanApplicationSchema,
  applicationReviewChecklistSchema,
  createLoanApplicationDraftSchema,
  listLoanApplicationsQuerySchema,
  rejectLoanApplicationSchema,
  requestApplicationDocumentUploadSchema,
  triggerApplicationCreditCheckSchema,
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
import { ApplicationDocumentsService } from './application-documents.service';
import { LoanApplicationsService } from './loan-applications.service';

@Controller('borrower/applications')
@UseGuards(JwtAuthGuard, BorrowerGuard)
export class BorrowerApplicationsController {
  constructor(
    private readonly applicationsService: LoanApplicationsService,
    private readonly applicationDocuments: ApplicationDocumentsService,
  ) {}

  @Post()
  createDraft(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createLoanApplicationDraftSchema))
    body: Parameters<LoanApplicationsService['createDraft']>[1],
  ) {
    return this.applicationsService.createDraft(user.sub, body);
  }

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listLoanApplicationsQuerySchema))
    query: Parameters<LoanApplicationsService['listForBorrower']>[1],
  ) {
    return this.applicationsService.listForBorrower(user.sub, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.applicationsService.getForBorrower(user.sub, id);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.applicationsService.finalizeSubmit(user.sub, id);
  }

  @Post(':id/withdraw')
  withdraw(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.applicationsService.withdraw(user.sub, id);
  }

  @Get(':id/documents')
  listDocuments(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.applicationDocuments.listForBorrower(user.sub, id);
  }

  @Post(':id/documents/upload-url')
  requestUploadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(requestApplicationDocumentUploadSchema))
    body: Parameters<ApplicationDocumentsService['requestUploadUrlForBorrower']>[2],
  ) {
    return this.applicationDocuments.requestUploadUrlForBorrower(user.sub, id, body);
  }

  @Get(':id/documents/:documentId/download-url')
  getDownloadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.applicationDocuments.getDownloadUrlForBorrower(
      user.sub,
      id,
      documentId,
    );
  }

  @Delete(':id/documents/:documentId')
  deleteDocument(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.applicationDocuments.deleteForBorrower(user.sub, id, documentId);
  }
}

@Controller('applications')
@UseGuards(JwtAuthGuard, LenderGuard, PlanGuard, RolesGuard)
export class LenderApplicationsController {
  constructor(
    private readonly applicationsService: LoanApplicationsService,
    private readonly applicationDocuments: ApplicationDocumentsService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listLoanApplicationsQuerySchema))
    query: Parameters<LoanApplicationsService['listForLender']>[2],
  ) {
    return this.applicationsService.listForLender(user.orgId!, user.sub, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.applicationsService.getForLender(user.orgId!, user.sub, id);
  }

  @Get(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  listDocuments(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.applicationDocuments.listForLender(user.orgId!, user.sub, id);
  }

  @Get(':id/documents/:documentId/download-url')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  getDownloadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.applicationDocuments.getDownloadUrlForLender(
      user.orgId!,
      user.sub,
      id,
      documentId,
    );
  }

  @Post(':id/review-checklist')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  saveReviewChecklist(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(applicationReviewChecklistSchema))
    body: Parameters<LoanApplicationsService['saveReviewChecklist']>[3],
  ) {
    return this.applicationsService.saveReviewChecklist(
      user.orgId!,
      user.sub,
      id,
      body,
    );
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  approve(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approveLoanApplicationSchema))
    body: Parameters<LoanApplicationsService['approve']>[3],
  ) {
    return this.applicationsService.approve(user.orgId!, user.sub, id, body);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  reject(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectLoanApplicationSchema))
    body: Parameters<LoanApplicationsService['reject']>[3],
  ) {
    return this.applicationsService.reject(user.orgId!, user.sub, id, body);
  }

  @Get(':id/credit-check')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  getLatestCreditCheck(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.applicationsService.getLatestCreditCheckForLender(
      user.orgId!,
      user.sub,
      id,
    );
  }

  @Post(':id/credit-check/pull')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  triggerCreditCheck(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(triggerApplicationCreditCheckSchema))
    body: Parameters<LoanApplicationsService['triggerCreditCheckForLender']>[3],
  ) {
    return this.applicationsService.triggerCreditCheckForLender(
      user.orgId!,
      user.sub,
      id,
      body,
    );
  }
}
