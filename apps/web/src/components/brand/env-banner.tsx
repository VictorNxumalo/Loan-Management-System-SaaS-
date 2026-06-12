'use client';

import { isSandboxDeployment } from '@/lib/app-env';

export function EnvBanner() {
  if (!isSandboxDeployment()) {
    return null;
  }

  return (
    <div
      role="status"
      className="border-b border-amber-300/80 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      Sandbox environment — test data only. Changes here do not affect production until merged
      to <code className="rounded bg-amber-950/10 px-1">main</code>.
    </div>
  );
}
