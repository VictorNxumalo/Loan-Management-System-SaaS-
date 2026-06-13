import { Module } from '@nestjs/common';
import { BorrowerWalletsController } from './borrower-wallets.controller';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  controllers: [WalletsController, BorrowerWalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
