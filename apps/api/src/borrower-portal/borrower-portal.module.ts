import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import {
  BorrowerPortalController,
  SettingsController,
} from './borrower-portal.controller';
import { BorrowerLendingConstraintsService } from './borrower-lending-constraints.service';
import {
  BorrowerPortalService,
  LenderSettingsService,
} from './borrower-portal.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [BorrowerPortalController, SettingsController],
  providers: [BorrowerPortalService, LenderSettingsService, BorrowerLendingConstraintsService],
  exports: [BorrowerLendingConstraintsService],
})
export class BorrowerPortalModule {}
