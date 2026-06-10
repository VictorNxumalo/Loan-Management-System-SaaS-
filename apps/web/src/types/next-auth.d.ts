import type { AuthMeResponse } from '@lms/types';
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    organisation?: AuthMeResponse['organisation'];
    error?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      emailVerified?: boolean;
      onboardingCompleted?: boolean;
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
    error?: string;
  }
}
