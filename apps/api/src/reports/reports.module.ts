import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoansModule } from '../loans/loans.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule, LoansModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
