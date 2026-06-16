import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformSupportAdminController } from './platform-support-admin.controller';
import { PlatformSupportService } from './platform-support.service';
import { SupportController } from './support.controller';

@Module({
  imports: [PrismaModule, AuditModule, EmailModule],
  controllers: [SupportController, PlatformSupportAdminController],
  providers: [PlatformSupportService],
})
export class PlatformSupportModule {}
