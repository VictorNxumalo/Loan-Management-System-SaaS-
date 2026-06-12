import { Suspense } from 'react';
import { PageLoading } from '@/components/brand/loading';
import { LoginForm } from './login-form';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { verified?: string };
}) {
  return (
    <Suspense fallback={<PageLoading label="Loading…" className="min-h-screen" />}>
      <LoginForm verified={searchParams.verified === '1'} />
    </Suspense>
  );
}
