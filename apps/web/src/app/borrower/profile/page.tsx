'use client';

import { PageHeader } from '@/components/page-header';
import { ProfileSettingsPanel } from '@/components/profile-settings-panel';

export default function BorrowerProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile & verification"
        description="View your verified details. Use Edit on each section when you need to make a change."
      />
      <ProfileSettingsPanel showPhone profileHref="/borrower/profile" />
    </div>
  );
}
