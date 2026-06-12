import {
  Controller,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LenderGuard } from '../common/guards/account-type.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { getEnv } from '../config/env';
import { NotificationSchedulerService } from '../notifications/notification-scheduler.service';
import { ReminderCronService } from '../notifications/reminder-cron.service';
import { OverdueSweepService } from './overdue-sweep.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, LenderGuard, PlanGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly overdueSweepService: OverdueSweepService,
    private readonly notificationSchedulerService: NotificationSchedulerService,
    private readonly reminderCronService: ReminderCronService,
  ) {}

  @Post('run-overdue-check')
  @Roles(UserRole.ADMIN)
  runOverdueCheck() {
    if (getEnv().NODE_ENV !== 'development') {
      throw new NotFoundException();
    }

    return this.overdueSweepService.sweepAllOrganisations();
  }

  @Post('run-repayment-reminders')
  @Roles(UserRole.ADMIN)
  runRepaymentReminders() {
    if (getEnv().NODE_ENV !== 'development') {
      throw new NotFoundException();
    }

    return this.reminderCronService.run('manual');
  }
}
