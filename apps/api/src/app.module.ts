import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { EmailModule } from './email/email.module';
import { BorrowersModule } from './borrowers/borrowers.module';
import { BorrowerLoansModule } from './borrower-loans/borrower-loans.module';
import { BorrowerPortalModule } from './borrower-portal/borrower-portal.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocumentsModule } from './documents/documents.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { LoanApplicationsModule } from './loan-applications/loan-applications.module';
import { LoansModule } from './loans/loans.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { PaymentSubmissionsModule } from './payment-submissions/payment-submissions.module';
import { ReportsModule } from './reports/reports.module';
import { SmsModule } from './sms/sms.module';
import { StorageModule } from './storage/storage.module';
import { ProfileModule } from './profile/profile.module';
import { TeamModule } from './team/team.module';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 1000,
      },
    ]),
    PrismaModule,
    QueueModule,
    StorageModule,
    SmsModule,
    EmailModule,
    AuthModule,
    AuditModule,
    TeamModule,
    BillingModule,
    LoansModule,
    BorrowersModule,
    DashboardModule,
    MarketplaceModule,
    BorrowerPortalModule,
    BorrowerLoansModule,
    LoanApplicationsModule,
    PaymentSubmissionsModule,
    NotificationsModule,
    DocumentsModule,
    ReportsModule,
    WalletsModule,
    ProfileModule,
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
