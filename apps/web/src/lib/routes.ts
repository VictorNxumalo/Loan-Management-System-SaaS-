import type { AuthMeResponse } from '@lms/types';

import type { Session } from 'next-auth';



export function getPostAuthRouteFromMe(me: AuthMeResponse): string {

  if (me.user.accountType === 'BORROWER') {

    return me.user.onboardingCompleted ? '/borrower' : '/borrower/onboarding';

  }



  if (me.user.onboardingCompleted === false) {

    return '/onboarding';

  }



  return '/dashboard';

}



export function getPostAuthRoute(session?: Session | null): string {

  const accountType = session?.user?.accountType;

  const onboardingCompleted = session?.user?.onboardingCompleted;



  if (accountType === 'BORROWER') {

    return onboardingCompleted ? '/borrower' : '/borrower/onboarding';

  }



  // Borrowers have no organisation; lenders always do after registration.

  if (!session?.organisation && accountType !== 'LENDER') {

    return onboardingCompleted ? '/borrower' : '/borrower/onboarding';

  }



  if (accountType === 'LENDER' && onboardingCompleted === false) {

    return '/onboarding';

  }



  if (onboardingCompleted === false) {

    return '/onboarding';

  }



  return '/dashboard';

}



export function isLenderAccount(me: AuthMeResponse): boolean {

  return me.user.accountType === 'LENDER';

}


