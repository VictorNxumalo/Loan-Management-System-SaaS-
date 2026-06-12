'use client';

import type { DocumentDto } from '@lms/types';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';

export function LenderApplicationDocumentsPanel({
  applicationId,
}: {
  applicationId: string;
}) {
  const api = useApi();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await api<DocumentDto[]>(`/applications/${applicationId}/documents`);
    setDocuments(rows);
  }, [api, applicationId]);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  const handleDownload = async (documentId: string) => {
    setError(null);
    try {
      const result = await api<{ downloadUrl: string }>(
        `/applications/${applicationId}/documents/${documentId}/download-url`,
      );
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Filename</th>
              <th className="px-3 py-2">Uploaded by</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-t">
                <td className="px-3 py-2">{doc.documentTypeLabel}</td>
                <td className="px-3 py-2">{doc.originalFilename}</td>
                <td className="px-3 py-2">{doc.uploadedByName}</td>
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
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No supporting documents
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
