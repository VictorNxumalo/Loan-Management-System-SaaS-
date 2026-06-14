'use client';

import type { DocumentDto, DocumentUploadUrlDto } from '@lms/types';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useApi } from '@/lib/use-api';

const MAX_BYTES = 10 * 1024 * 1024;

type DocumentTypeOption = { value: string; label: string };

export function DocumentUploadPanel({
  entityType,
  entityId,
  documentTypes,
  canManage,
  title = 'Documents',
  description,
}: {
  entityType: 'BORROWER' | 'LOAN';
  entityId: string;
  documentTypes: DocumentTypeOption[];
  canManage: boolean;
  title?: string;
  description?: string;
}) {
  const api = useApi();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [documentType, setDocumentType] = useState(documentTypes[0]?.value ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const rows = await api<DocumentDto[]>(
      `/documents?entityType=${entityType}&entityId=${entityId}`,
    );
    setDocuments(rows);
  }, [api, entityType, entityId]);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  const handleUpload = async () => {
    if (!file || !documentType) {
      return;
    }

    if (file.size > MAX_BYTES) {
      setError('File must be 10 MB or smaller');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const uploadMeta = await api<DocumentUploadUrlDto>('/documents/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          entityType,
          entityId,
          documentType,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });

      const uploadResponse = await fetch(uploadMeta.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload to storage failed');
      }

      setFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentId: string) => {
    setError(null);
    try {
      const result = await api<{ downloadUrl: string; originalFilename: string }>(
        `/documents/${documentId}/download-url`,
      );
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!window.confirm('Delete this document?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api(`/documents/${documentId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {canManage && documentTypes.length > 0 && (
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`doc-type-${entityId}`}>Document type</Label>
              <select
                id={`doc-type-${entityId}`}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {documentTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`doc-file-${entityId}`}>File (PDF, JPEG, PNG — max 10 MB)</Label>
              <input
                id={`doc-file-${entityId}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                className="block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="md:col-span-3">
              <Button
                disabled={loading || !file}
                onClick={() => void handleUpload()}
              >
                {loading ? 'Uploading…' : 'Upload document'}
              </Button>
            </div>
          </div>
        )}

        {!canManage && (
          <p className="text-sm text-muted-foreground">
            You have read-only access. Contact an admin or loan officer to upload documents.
          </p>
        )}

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Filename</th>
                <th className="px-3 py-2">Uploaded by</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Actions</th>
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
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No documents uploaded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
