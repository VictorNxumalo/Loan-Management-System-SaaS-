import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  listWalletTransactionsQuerySchema,
  UserRole,
  walletBankAccountSchema,
  walletTopUpSchema,
  walletWithdrawSchema,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LenderGuard } from '../common/guards/account-type.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WalletsService } from './wallets.service';

@Controller('wallets')
@UseGuards(JwtAuthGuard, LenderGuard, PlanGuard, RolesGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  getMyWallet(@CurrentUser() user: AccessTokenPayload) {
    return this.walletsService.getOrgWallet(user.orgId!, user.sub);
  }

  @Put('me/bank-account')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  updateBankAccount(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(walletBankAccountSchema))
    body: Parameters<WalletsService['upsertOrgBankAccount']>[2],
  ) {
    return this.walletsService.upsertOrgBankAccount(user.orgId!, user.sub, body);
  }

  @Get('me/transactions')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  listTransactions(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listWalletTransactionsQuerySchema))
    query: Parameters<WalletsService['listOrgTransactions']>[2],
  ) {
    return this.walletsService.listOrgTransactions(user.orgId!, user.sub, query);
  }

  @Post('me/top-up')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  topUp(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(walletTopUpSchema))
    body: Parameters<WalletsService['recordOrgTopUp']>[2],
  ) {
    return this.walletsService.recordOrgTopUp(user.orgId!, user.sub, body);
  }

  @Post('me/withdraw')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  withdraw(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(walletWithdrawSchema))
    body: Parameters<WalletsService['recordOrgWithdrawal']>[2],
  ) {
    return this.walletsService.recordOrgWithdrawal(user.orgId!, user.sub, body);
  }
}
