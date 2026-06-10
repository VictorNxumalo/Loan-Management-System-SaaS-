import { VerifyEmailClient } from './verify-email-client';

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <VerifyEmailClient token={searchParams.token ?? null} />;
}
