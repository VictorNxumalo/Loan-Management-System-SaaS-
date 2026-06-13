'use client';

import type { OrganisationLogoUploadUrlDto } from '@lms/types';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

type UploadRequest = (body: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}) => Promise<OrganisationLogoUploadUrlDto>;

export function OrganisationLogoUpload({
  onStoragePathChange,
  storagePath,
  requestUploadUrl,
  disabled,
  className,
}: {
  storagePath: string | null;
  onStoragePathChange: (path: string | null) => void;
  requestUploadUrl: UploadRequest;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    setError(null);
    if (!file) {
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
      setError('Use PNG, JPEG, or WebP');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Logo must be 2 MB or smaller');
      return;
    }

    setUploading(true);
    try {
      const meta = await requestUploadUrl({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      const response = await fetch(meta.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(file));
      onStoragePathChange(meta.storagePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload logo');
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onStoragePathChange(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Label>Organisation logo (optional)</Label>
      <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-brand-navy/15 bg-brand-gray/40 p-4 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background shadow-sm">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Logo preview"
              width={80}
              height={80}
              className="h-full w-full object-contain"
              unoptimized
            />
          ) : (
            <span className="text-xs text-muted-foreground">No logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            Square PNG, JPEG, or WebP. Shown to borrowers when they browse lenders.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? 'Uploading…' : storagePath ? 'Replace logo' : 'Upload logo'}
            </Button>
            {(storagePath || previewUrl) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || uploading}
                onClick={clear}
              >
                Remove
              </Button>
            )}
          </div>
          {storagePath && !error && (
            <p className="text-xs text-brand-green">Logo ready to save</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
