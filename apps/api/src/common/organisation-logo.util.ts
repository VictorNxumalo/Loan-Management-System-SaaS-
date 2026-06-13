import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { randomUUID } from 'crypto';

const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function assertValidLogoUpload(contentType: string, sizeBytes: number): void {
  if (!ALLOWED_LOGO_TYPES.has(contentType)) {
    throw new BadRequestException('Logo must be PNG, JPEG, or WebP');
  }
  if (sizeBytes > MAX_LOGO_BYTES) {
    throw new BadRequestException('Logo must be 2 MB or smaller');
  }
}

export function buildOrganisationLogoPath(
  orgId: string,
  filename: string,
  contentType: string,
): string {
  if (!ALLOWED_LOGO_TYPES.has(contentType)) {
    throw new BadRequestException('Logo must be PNG, JPEG, or WebP');
  }
  const ext =
    extname(filename).toLowerCase() ||
    (contentType === 'image/png'
      ? '.png'
      : contentType === 'image/webp'
        ? '.webp'
        : '.jpg');
  return `orgs/${orgId}/branding/logo-${randomUUID()}${ext}`;
}

export function assertLogoPathForOrg(orgId: string, storagePath: string): void {
  const prefix = `orgs/${orgId}/branding/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) {
    throw new BadRequestException('Invalid logo storage path');
  }
}

export function getOrganisationLogoStoragePath(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') {
    return null;
  }
  const value = (settings as Record<string, unknown>).logoStoragePath;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
