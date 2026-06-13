import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  listWalletTransactionsQuerySchema,
  walletBankAccountSchema,
} from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { BorrowerGuard } from '../common/guards/account-type.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WalletsService } from './wallets.service';

@Controller('borrower/wallet')
@UseGuards(JwtAuthGuard, BorrowerGuard)
export class BorrowerWalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  getWallet(@CurrentUser() user: AccessTokenPayload) {
    return this.walletsService.getBorrowerWallet(user.sub);
  }

  @Put('bank-account')
  updateBankAccount(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(walletBankAccountSchema))
    body: Parameters<WalletsService['upsertBorrowerBankAccount']>[1],
  ) {
    return this.walletsService.upsertBorrowerBankAccount(user.sub, body);
  }

  @Get('transactions')
  listTransactions(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listWalletTransactionsQuerySchema))
    query: Parameters<WalletsService['listBorrowerTransactions']>[1],
  ) {
    return this.walletsService.listBorrowerTransactions(user.sub, query);
  }
}
