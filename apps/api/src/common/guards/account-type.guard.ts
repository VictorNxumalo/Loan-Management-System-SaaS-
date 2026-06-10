import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AccountType } from '@lms/types';
import type { AccessTokenPayload } from '../../auth/token.service';

@Injectable()
export class LenderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as AccessTokenPayload;

    if (user.accountType !== AccountType.LENDER || !user.orgId) {
      throw new ForbiddenException('Lender account required');
    }

    return true;
  }
}

@Injectable()
export class BorrowerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as AccessTokenPayload;

    if (user.accountType !== AccountType.BORROWER) {
      throw new ForbiddenException('Borrower account required');
    }

    return true;
  }
}
