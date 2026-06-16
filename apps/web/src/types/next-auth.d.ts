import type { AuthMeResponse } from '@lms/types';
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    organisation?: AuthMeResponse['organisation'];
    borrowerProfile?: AuthMeResponse['borrowerProfile'];
    error?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      accountType?: string;
      role?: string | null;
      emailVerified?: boolean;
      onboardingCompleted?: boolean;
      profileComplete?: boolean;
      isPlatformAdmin?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    user?: AuthMeResponse['user'];
    organisation?: AuthMeResponse['organisation'];
    borrowerProfile?: AuthMeResponse['borrowerProfile'];
    error?: string;
  }
}
