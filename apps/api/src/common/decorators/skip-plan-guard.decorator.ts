import { SetMetadata } from '@nestjs/common';

export const SKIP_PLAN_GUARD_KEY = 'skipPlanGuard';

/** Skip read-only plan enforcement (auth, webhooks, billing). */
export const SkipPlanGuard = () => SetMetadata(SKIP_PLAN_GUARD_KEY, true);
