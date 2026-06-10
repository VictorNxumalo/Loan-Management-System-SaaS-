export function isPublicListingEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') {
    return false;
  }

  const value = (settings as Record<string, unknown>).publicListing;
  return value === true || value === 'true';
}

export function defaultLenderOrganisationSettings(
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...existing,
    publicListing: existing.publicListing ?? true,
  };
}
