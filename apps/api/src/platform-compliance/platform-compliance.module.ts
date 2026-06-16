import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformComplianceController } from './platform-compliance.controller';
import { PlatformComplianceService } from './platform-compliance.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PlatformComplianceController],
  providers: [PlatformComplianceService],
})
export class PlatformComplianceModule {}
