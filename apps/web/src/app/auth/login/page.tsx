import { LoginForm } from './login-form';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { verified?: string };
}) {
  return <LoginForm verified={searchParams.verified === '1'} />;
}
