'use client';

import type { KycDocumentUploadUrlDto } from '@lms/types';
import { UserKycDocumentType, USER_KYC_DOCUMENT_LABELS } from '@lms/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

const MAX_BYTES = 10 * 1024 * 1024;

export function KycIdUpload({
  accessToken,
  uploadedFilename,
  onUploaded,
  disabled,
}: {
  accessToken?: string;
  uploadedFilename?: string | null;
  onUploaded?: (filename: string) => void;
  disabled?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(uploadedFilename ?? null);

  const handleUpload = async () => {
    if (!file || !accessToken) return;

    if (file.size > MAX_BYTES) {
      setError('File must be 10 MB or smaller');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const meta = await apiFetch<KycDocumentUploadUrlDto>(
        '/auth/profile/id-document/upload-url',
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify({
            documentType: UserKycDocumentType.ID_COPY,
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        },
      );

      const response = await fetch(meta.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Upload to storage failed');
      }

      setUploaded(file.name);
      setFile(null);
      onUploaded?.(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div>
        <Label htmlFor="kyc-id-file">{USER_KYC_DOCUMENT_LABELS.ID_COPY}</Label>
        <p className="text-xs text-muted-foreground">
          Upload a clear coloured copy of your South African ID (PDF, JPEG, or PNG).
        </p>
      </div>

      {uploaded && (
        <p className="text-sm text-brand-green">
          Uploaded: {uploaded}
        </p>
      )}

      <Input
        id="kyc-id-file"
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        disabled={disabled || loading}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        variant="secondary"
        disabled={!file || loading || disabled}
        onClick={() => void handleUpload()}
      >
        {loading ? 'Uploading…' : uploaded ? 'Replace ID document' : 'Upload ID document'}
      </Button>
    </div>
  );
}
