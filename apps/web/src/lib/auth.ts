import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import type { AuthTokensResponse } from '@lms/types';
import { apiFetch } from './api';

function isGoogleOAuthEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

type TokenBundle = AuthTokensResponse & { refreshToken: string };

interface CredentialsUser {
  id: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthTokensResponse['user'];
  organisation: AuthTokensResponse['organisation'];
}

async function refreshAccessToken(refreshToken: string): Promise<TokenBundle | null> {
  try {
    return await apiFetch<TokenBundle>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const data = await apiFetch<TokenBundle>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        const credUser: CredentialsUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + data.expiresIn * 1000,
          user: data.user,
          organisation: data.organisation,
        };
        return credUser;
      },
    }),
    ...(isGoogleOAuthEnabled()
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google' && account.id_token) {
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === 'google' && account.id_token) {
        const data = await apiFetch<TokenBundle>('/auth/google', {
          method: 'POST',
          body: JSON.stringify({ idToken: account.id_token }),
        });

        return {
          ...token,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + data.expiresIn * 1000,
          user: data.user,
          organisation: data.organisation,
        };
      }

      if (user) {
        const credUser = user as CredentialsUser;
        return {
          ...token,
          accessToken: credUser.accessToken,
          refreshToken: credUser.refreshToken,
          expiresAt: credUser.expiresAt,
          user: credUser.user,
          organisation: credUser.organisation,
        };
      }

      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() < expiresAt - 60_000) {
        return token;
      }

      const refreshed = await refreshAccessToken(token.refreshToken as string);
      if (!refreshed) {
        return { ...token, error: 'RefreshAccessTokenError' };
      }

      return {
        ...token,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000,
        user: refreshed.user,
        organisation: refreshed.organisation,
      };
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user = {
        ...session.user,
        id: (token.user as AuthTokensResponse['user'])?.id,
        role: (token.user as AuthTokensResponse['user'])?.role,
        emailVerified: (token.user as AuthTokensResponse['user'])?.emailVerified,
        onboardingCompleted: (token.user as AuthTokensResponse['user'])
          ?.onboardingCompleted,
      };
      session.organisation = token.organisation as AuthTokensResponse['organisation'];
      session.error = token.error as string | undefined;
      return session;
    },
  },
};
