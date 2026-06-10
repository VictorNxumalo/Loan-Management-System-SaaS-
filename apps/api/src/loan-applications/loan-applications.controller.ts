import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  approveLoanApplicationSchema,
  listLoanApplicationsQuerySchema,
  rejectLoanApplicationSchema,
  submitLoanApplicationSchema,
  UserRole,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BorrowerGuard, LenderGuard } from '../common/guards/account-type.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LoanApplicationsService } from './loan-applications.service';

@Controller('borrower/applications')
@UseGuards(JwtAuthGuard, BorrowerGuard)
export class BorrowerApplicationsController {
  constructor(private readonly applicationsService: LoanApplicationsService) {}

  @Post()
  submit(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(submitLoanApplicationSchema))
    body: Parameters<LoanApplicationsService['submit']>[1],
  ) {
    return this.applicationsService.submit(user.sub, body);
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

  @Post(':id/withdraw')
  withdraw(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.applicationsService.withdraw(user.sub, id);
  }
}

@Controller('applications')
@UseGuards(JwtAuthGuard, LenderGuard, RolesGuard)
export class LenderApplicationsController {
  constructor(private readonly applicationsService: LoanApplicationsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listLoanApplicationsQuerySchema))
    query: Parameters<LoanApplicationsService['listForLender']>[2],
  ) {
    return this.applicationsService.listForLender(user.orgId!, user.sub, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.applicationsService.getForLender(user.orgId!, user.sub, id);
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
}
