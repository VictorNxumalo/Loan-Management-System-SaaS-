import type { AuthMeResponse } from '@lms/types';

import type { Session } from 'next-auth';

export function getPostAuthRouteFromMe(me: AuthMeResponse): string {
  const needsProfile = !me.user.profileComplete;

  if (me.user.accountType === 'BORROWER') {
    return needsProfile ? '/borrower/onboarding' : '/borrower';
  }

  return needsProfile ? '/onboarding' : '/dashboard';
}

export function getPostAuthRoute(session?: Session | null): string {
  const accountType = session?.user?.accountType;
  const profileComplete = session?.user?.profileComplete;

  const needsProfile = profileComplete !== true;

  if (accountType === 'BORROWER') {
    return needsProfile ? '/borrower/onboarding' : '/borrower';
  }

  if (!session?.organisation && accountType !== 'LENDER') {
    return needsProfile ? '/borrower/onboarding' : '/borrower';
  }

  if (accountType === 'LENDER' && needsProfile) {
    return '/onboarding';
  }

  return needsProfile ? '/onboarding' : '/dashboard';
}

export function isLenderAccount(me: AuthMeResponse): boolean {
  return me.user.accountType === 'LENDER';
}
