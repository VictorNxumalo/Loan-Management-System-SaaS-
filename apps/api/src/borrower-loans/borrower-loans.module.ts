import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoansModule } from '../loans/loans.module';
import { WalletsModule } from '../wallets/wallets.module';
import { BorrowerLoansController } from './borrower-loans.controller';
import { BorrowerLoansService } from './borrower-loans.service';

@Module({
  imports: [AuthModule, LoansModule, WalletsModule],
  controllers: [BorrowerLoansController],
  providers: [BorrowerLoansService],
})
export class BorrowerLoansModule {}
