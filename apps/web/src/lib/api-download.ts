const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export async function apiDownload(
  path: string,
  accessToken: string,
  fallbackFilename: string,
): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      const data = (await response.json()) as { message?: string; error?: { message: string } };
      message = data.error?.message ?? data.message ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackFilename;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
