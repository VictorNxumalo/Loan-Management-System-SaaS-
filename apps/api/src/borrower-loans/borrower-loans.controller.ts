import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { listBorrowerLoansQuerySchema, payFromWalletSchema } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BorrowerGuard } from '../common/guards/account-type.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BorrowerLoansService } from './borrower-loans.service';

@Controller('borrower/loans')
@UseGuards(JwtAuthGuard, BorrowerGuard)
export class BorrowerLoansController {
  constructor(private readonly borrowerLoansService: BorrowerLoansService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listBorrowerLoansQuerySchema))
    query: Parameters<BorrowerLoansService['list']>[1],
  ) {
    return this.borrowerLoansService.list(user.sub, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.borrowerLoansService.getById(user.sub, id);
  }

  @Post(':id/pay-from-wallet')
  payFromWallet(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(payFromWalletSchema))
    body: Parameters<BorrowerLoansService['payFromWallet']>[2],
  ) {
    return this.borrowerLoansService.payFromWallet(user.sub, id, body);
  }
}
