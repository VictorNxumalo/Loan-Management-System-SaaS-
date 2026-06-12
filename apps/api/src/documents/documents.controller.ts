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
  listDocumentsQuerySchema,
  requestDocumentUploadSchema,
  UserRole,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LenderGuard } from '../common/guards/account-type.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, LenderGuard, PlanGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listDocumentsQuerySchema))
    query: Parameters<DocumentsService['list']>[2],
  ) {
    return this.documentsService.list(user.orgId!, user.sub, query);
  }

  @Post('upload-url')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  requestUploadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(requestDocumentUploadSchema))
    body: Parameters<DocumentsService['requestUploadUrl']>[2],
  ) {
    return this.documentsService.requestUploadUrl(user.orgId!, user.sub, body);
  }

  @Get(':id/download-url')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  getDownloadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ) {
    return this.documentsService.getDownloadUrl(user.orgId!, user.sub, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.documentsService.softDelete(user.orgId!, user.sub, id);
  }
}
