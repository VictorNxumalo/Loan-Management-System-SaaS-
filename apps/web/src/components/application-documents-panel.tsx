'use client';

import type { DocumentDto } from '@lms/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ApplicationDocumentsPanel({
  applicationId,
  requirements,
}: {
  applicationId: string;
  requirements: {
    documentType: string;
    label: string;
    min: number;
    max: number;
    uploaded: number;
    met: boolean;
  }[];
}) {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { apiFetch } = await import('@/lib/api');
    const { getSession } = await import('next-auth/react');
    const session = await getSession();
    const rows = await apiFetch<DocumentDto[]>(
      `/borrower/applications/${applicationId}/documents`,
      { accessToken: session?.accessToken },
    );
    setDocuments(rows);
  }, [applicationId]);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  const handleDownload = async (documentId: string) => {
    setError(null);
    try {
      const { apiFetch } = await import('@/lib/api');
      const { getSession } = await import('next-auth/react');
      const session = await getSession();
      const result = await apiFetch<{ downloadUrl: string }>(
        `/borrower/applications/${applicationId}/documents/${documentId}/download-url`,
        { accessToken: session?.accessToken },
      );
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const allMet = requirements.every((item) => item.met);

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-4">
        <p className="text-sm font-medium">Documents included with this application</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your SA ID from your profile is attached automatically for the lender to review.
          Update it in{' '}
          <Link href="/borrower/profile" className="font-medium text-primary underline-offset-4 hover:underline">
            profile settings
          </Link>{' '}
          if it changes.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {requirements.map((item) => (
            <li key={item.documentType} className="flex items-center gap-2">
              <span className={item.met ? 'text-green-700' : 'text-amber-700'}>
                {item.met ? '✓' : '○'}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
        {!allMet && (
          <p className="mt-3 text-sm text-amber-700">
            Upload your SA ID in profile settings before submitting.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Filename</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-t">
                <td className="px-3 py-2">{doc.documentTypeLabel}</td>
                <td className="px-3 py-2">{doc.originalFilename}</td>
                <td className="px-3 py-2">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDownload(doc.id)}
                  >
                    Download
                  </Button>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No documents linked yet — complete your profile ID upload first
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
