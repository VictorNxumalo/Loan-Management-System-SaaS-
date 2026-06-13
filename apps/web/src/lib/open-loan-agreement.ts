import { getApiBaseUrl } from './api-url';

/** Opens an LMS-generated loan agreement HTML document in a new browser tab. */
export async function openLoanAgreementHtml(
  path: string,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    let message = `Could not generate agreement (${response.status})`;
    try {
      const data = (await response.json()) as { message?: string; error?: { message: string } };
      message = data.error?.message ?? data.message ?? message;
    } catch {
      // HTML error bodies are ignored
    }
    throw new Error(message);
  }

  const html = await response.text();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
