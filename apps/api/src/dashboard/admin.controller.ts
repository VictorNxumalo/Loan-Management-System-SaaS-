import {
  Controller,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { getEnv } from '../config/env';
import { OverdueSweepService } from './overdue-sweep.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly overdueSweepService: OverdueSweepService) {}

  @Post('run-overdue-check')
  @Roles(UserRole.ADMIN)
  runOverdueCheck() {
    if (getEnv().NODE_ENV !== 'development') {
      throw new NotFoundException();
    }

    return this.overdueSweepService.sweepAllOrganisations();
  }
}
