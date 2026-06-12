import { Suspense } from 'react';
import { PageLoading } from '@/components/brand/loading';
import { RegisterForm } from './register-form';

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading…" className="min-h-screen" />}>
      <RegisterForm />
    </Suspense>
  );
}
