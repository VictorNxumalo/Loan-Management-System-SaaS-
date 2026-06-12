import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createLoanSchema,
  createRepaymentSchema,
  listLoansQuerySchema,
  previewScheduleInputSchema,
  updateLoanSchema,
  UserRole,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LenderGuard } from '../common/guards/account-type.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LoansService } from './loans.service';

@Controller('loans')
@UseGuards(JwtAuthGuard, LenderGuard, PlanGuard, RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post('preview-schedule')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  previewSchedule(
    @Body(new ZodValidationPipe(previewScheduleInputSchema)) body: Parameters<
      LoansService['previewSchedule']
    >[0],
  ) {
    return this.loansService.previewSchedule(body);
  }

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listLoansQuerySchema)) query: Parameters<
      LoansService['list']
    >[2],
  ) {
    return this.loansService.list(user.orgId!, user.sub, query);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createLoanSchema)) body: Parameters<
      LoansService['create']
    >[2],
  ) {
    return this.loansService.create(user.orgId!, user.sub, body);
  }

  @Get(':id')
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.loansService.getById(user.orgId!, user.sub, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLoanSchema)) body: Parameters<
      LoansService['update']
    >[3],
  ) {
    return this.loansService.update(user.orgId!, user.sub, id, body);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  activate(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.loansService.activate(user.orgId!, user.sub, id);
  }

  @Get(':id/repayments')
  listRepayments(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ) {
    return this.loansService.listRepayments(user.orgId!, user.sub, id);
  }

  @Post(':id/repayments')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  recordRepayment(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createRepaymentSchema)) body: Parameters<
      LoansService['recordRepayment']
    >[3],
  ) {
    return this.loansService.recordRepayment(user.orgId!, user.sub, id, body);
  }
}
