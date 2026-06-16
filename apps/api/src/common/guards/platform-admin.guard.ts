import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../../auth/token.service';
import { isPlatformAdminEmail } from '../../config/env';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const user = request.user;

    if (!user?.email || !isPlatformAdminEmail(user.email)) {
      throw new ForbiddenException('Platform operator access required');
    }

    return true;
  }
}
