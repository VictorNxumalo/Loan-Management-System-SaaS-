'use client';

import type { DocumentDto, DocumentUploadUrlDto } from '@lms/types';
import {
  APPLICATION_DOCUMENT_LABELS,
  APPLICATION_DOCUMENT_REQUIREMENTS,
  ApplicationDocumentType,
} from '@lms/types';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const MAX_BYTES = 10 * 1024 * 1024;

const UPLOAD_OPTIONS = [
  {
    value: ApplicationDocumentType.ID_COPY,
    label: APPLICATION_DOCUMENT_LABELS.ID_COPY,
    hint: 'Clear copy of your South African ID (PDF or image)',
  },
  {
    value: ApplicationDocumentType.BANK_STATEMENT,
    label: APPLICATION_DOCUMENT_LABELS.BANK_STATEMENT,
    hint: 'Upload 1–3 recent statements (one file per month if possible)',
  },
];

export function ApplicationDocumentsPanel({
  applicationId,
  requirements,
  canManage,
  onChange,
}: {
  applicationId: string;
  requirements: { documentType: string; label: string; min: number; max: number; uploaded: number; met: boolean }[];
  canManage: boolean;
  onChange?: () => void;
}) {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [documentType, setDocumentType] = useState<string>(ApplicationDocumentType.ID_COPY);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleUpload = async () => {
    if (!file) {
      return;
    }

    if (file.size > MAX_BYTES) {
      setError('File must be 10 MB or smaller');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { apiFetch } = await import('@/lib/api');
      const { getSession } = await import('next-auth/react');
      const session = await getSession();

      const uploadMeta = await apiFetch<DocumentUploadUrlDto>(
        `/borrower/applications/${applicationId}/documents/upload-url`,
        {
          method: 'POST',
          accessToken: session?.accessToken,
          body: JSON.stringify({
            documentType,
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        },
      );

      const uploadResponse = await fetch(uploadMeta.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload to storage failed');
      }

      setFile(null);
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

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

  const handleDelete = async (documentId: string) => {
    if (!window.confirm('Remove this document?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { apiFetch } = await import('@/lib/api');
      const { getSession } = await import('next-auth/react');
      const session = await getSession();
      await apiFetch(`/borrower/applications/${applicationId}/documents/${documentId}`, {
        method: 'DELETE',
        accessToken: session?.accessToken,
      });
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-4">
        <p className="text-sm font-medium">Required documents</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {requirements.map((item) => (
            <li key={item.documentType} className="flex items-center gap-2">
              <span className={item.met ? 'text-green-700' : 'text-amber-700'}>
                {item.met ? '✓' : '○'}
              </span>
              {item.label}: {item.uploaded}/{item.min}
              {item.max > 1 ? ` (up to ${item.max})` : ''}
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canManage && (
        <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`app-doc-type-${applicationId}`}>Document type</Label>
            <select
              id={`app-doc-type-${applicationId}`}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as ApplicationDocumentType)}
            >
              {UPLOAD_OPTIONS.map((option) => {
                const rule =
                  APPLICATION_DOCUMENT_REQUIREMENTS[
                    option.value as ApplicationDocumentType
                  ];
                const req = requirements.find((r) => r.documentType === option.value);
                const atMax = req ? req.uploaded >= rule.max : false;
                return (
                  <option key={option.value} value={option.value} disabled={atMax}>
                    {option.label}
                    {atMax ? ' (maximum reached)' : ''}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-muted-foreground">
              {UPLOAD_OPTIONS.find((o) => o.value === documentType)?.hint}
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`app-doc-file-${applicationId}`}>
              File (PDF, JPEG, PNG — max 10 MB)
            </Label>
            <input
              id={`app-doc-file-${applicationId}`}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="md:col-span-3">
            <Button disabled={loading || !file} onClick={() => void handleUpload()}>
              {loading ? 'Uploading…' : 'Upload document'}
            </Button>
          </div>
        </div>
      )}

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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDownload(doc.id)}
                    >
                      Download
                    </Button>
                    {canManage && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={loading}
                        onClick={() => void handleDelete(doc.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No documents uploaded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
