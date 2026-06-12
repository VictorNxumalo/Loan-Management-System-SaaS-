import { getApiBaseUrl } from './api-url';

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...rest } = options;

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  const data = (await response.json()) as T & { message?: string; error?: { message: string } };

  if (!response.ok) {
    const message =
      data.error?.message ?? data.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export function isGoogleOAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}
