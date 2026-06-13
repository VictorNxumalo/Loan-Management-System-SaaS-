/** Build Supabase storage path for a user's KYC document. */
export function buildUserKycDocumentPath(
  userId: string,
  documentType: string,
  filename: string,
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return `kyc/${userId}/${documentType}/${Date.now()}-${safeName}`;
}

export function assertUserKycDocumentPath(userId: string, storagePath: string): void {
  const prefix = `kyc/${userId}/`;
  if (!storagePath.startsWith(prefix)) {
    throw new Error('Invalid KYC document storage path');
  }
}

const ALLOWED_KYC_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function assertValidKycUpload(contentType: string, sizeBytes: number): void {
  if (!ALLOWED_KYC_CONTENT_TYPES.has(contentType)) {
    throw new Error('File type must be PDF, JPEG, PNG, or WebP');
  }
  if (sizeBytes > 10_485_760) {
    throw new Error('File must be 10 MB or smaller');
  }
}
