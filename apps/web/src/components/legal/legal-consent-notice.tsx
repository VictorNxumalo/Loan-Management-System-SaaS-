import Link from 'next/link';

export function LegalConsentNotice() {
  return (
    <p className="text-center text-xs leading-relaxed text-muted-foreground">
      By creating an account, you agree to our <LegalInlineLinks />.
    </p>
  );
}

export function LegalFooterLinks() {
  return (
    <p className="text-center text-xs leading-relaxed text-muted-foreground">
      View our <LegalInlineLinks />.
    </p>
  );
}

function LegalInlineLinks() {
  return (
    <>
      <Link href="/legal/terms" className="font-medium text-brand-green hover:underline">
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link href="/legal/privacy" className="font-medium text-brand-green hover:underline">
        Privacy Policy
      </Link>
    </>
  );
}
