import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { BorrowersModule } from './borrowers/borrowers.module';
import { BorrowerLoansModule } from './borrower-loans/borrower-loans.module';
import { BorrowerPortalModule } from './borrower-portal/borrower-portal.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { LoanApplicationsModule } from './loan-applications/loan-applications.module';
import { LoansModule } from './loans/loans.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 1000,
      },
    ]),
    PrismaModule,
    EmailModule,
    AuthModule,
    LoansModule,
    BorrowersModule,
    DashboardModule,
    MarketplaceModule,
    BorrowerPortalModule,
    BorrowerLoansModule,
    LoanApplicationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
