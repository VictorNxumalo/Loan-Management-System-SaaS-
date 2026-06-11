import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LenderGuard } from '../common/guards/account-type.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, LenderGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('portfolio.csv')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  async portfolioCsv(@CurrentUser() user: AccessTokenPayload) {
    const csv = await this.reportsService.generatePortfolioCsv(user.orgId!, user.sub);
    const buffer = Buffer.from(csv, 'utf-8');
    return new StreamableFile(buffer, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="portfolio-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }

  @Get('arrears.csv')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  async arrearsCsv(@CurrentUser() user: AccessTokenPayload) {
    const csv = await this.reportsService.generateArrearsCsv(user.orgId!, user.sub);
    const buffer = Buffer.from(csv, 'utf-8');
    return new StreamableFile(buffer, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="arrears-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }

  @Get('borrowers/:borrowerId/statement.pdf')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER, UserRole.VIEWER)
  async borrowerStatement(
    @CurrentUser() user: AccessTokenPayload,
    @Param('borrowerId') borrowerId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.reportsService.generateBorrowerStatementPdf(
      user.orgId!,
      user.sub,
      borrowerId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(buffer);
  }
}
