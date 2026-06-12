import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountType } from '@lms/types';
import type { AccessTokenPayload } from '../../auth/token.service';
import { SKIP_PLAN_GUARD_KEY } from '../decorators/skip-plan-guard.decorator';
import { BillingService } from '../../billing/billing.service';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly billingService: BillingService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PLAN_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ method: string; user?: AccessTokenPayload }>();
    if (READ_METHODS.has(request.method)) {
      return true;
    }

    const user = request.user;
    if (!user?.orgId || user.accountType !== AccountType.LENDER) {
      return true;
    }

    try {
      await this.billingService.assertWritable(user.orgId, user.sub);
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      throw err;
    }
  }
}
