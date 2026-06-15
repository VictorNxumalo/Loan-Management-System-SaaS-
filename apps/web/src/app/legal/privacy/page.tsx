import Link from 'next/link';
import { LegalSection, LegalPageShell } from '@/components/legal/legal-page-shell';
import {
  getLegalContactEmail,
  getLegalOperatorName,
  LEGAL_LAST_UPDATED,
  PRODUCT_FULL_NAME,
} from '@/lib/legal-config';

export const metadata = {
  title: 'Privacy Policy · LMS',
  description: `Privacy Policy for the ${PRODUCT_FULL_NAME} platform, including POPIA information.`,
};

export default function PrivacyPage() {
  const operator = getLegalOperatorName();
  const contactEmail = getLegalContactEmail();

  return (
    <LegalPageShell
      active="privacy"
      title="Privacy Policy"
      description={`Last updated: ${LEGAL_LAST_UPDATED}. How we collect, use, and protect personal information.`}
    >
      <LegalSection id="introduction" title="1. Introduction">
        <p>
          This Privacy Policy explains how <strong>{operator}</strong> (&quot;we&quot;,
          &quot;us&quot;, or &quot;our&quot;) processes personal information when you use the{' '}
          {PRODUCT_FULL_NAME} platform (&quot;LMS&quot; or &quot;Platform&quot;).
        </p>
        <p>
          We process personal information in accordance with the Protection of Personal
          Information Act 4 of 2013 (&quot;POPIA&quot;) and other applicable South African
          privacy laws.
        </p>
        <p>
          By using LMS, you acknowledge this Policy. Where we act as a{' '}
          <strong>operator</strong> on behalf of lender organisations, lenders may also be{' '}
          <strong>responsible parties</strong> for borrower data they collect and decisions they
          make. This Policy describes our role as the platform provider.
        </p>
      </LegalSection>

      <LegalSection id="responsible-party" title="2. Responsible party">
        <p>
          <strong>{operator}</strong> is the responsible party for personal information processed
          to provide and secure the Platform.
        </p>
        <p>
          Privacy enquiries and requests:{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" title="3. Information we collect">
        <h3>Account and profile data</h3>
        <ul>
          <li>Name, email address, password (stored hashed), account type (lender/borrower);</li>
          <li>For lenders: organisation name, plan, team role, onboarding settings;</li>
          <li>For borrowers: phone number and optional ID number during onboarding;</li>
          <li>Authentication tokens, session data, and audit metadata (IP/time where logged).</li>
        </ul>

        <h3>Lending activity data</h3>
        <ul>
          <li>Loan applications, purposes, amounts, schedules, and review checklists;</li>
          <li>Loan records, repayment status, arrears, and balance calculations;</li>
          <li>Bank account details supplied for loan disbursement (account holder, bank, branch
            code, account number);</li>
          <li>Payment proof submissions and lender approval/rejection decisions;</li>
          <li>In-app notifications and audit log entries describing platform actions.</li>
        </ul>

        <h3>Documents and uploads</h3>
        <ul>
          <li>Identity, income, or supporting documents attached to applications;</li>
          <li>Proof-of-payment files uploaded by borrowers;</li>
          <li>Organisation logos and other files lenders upload.</li>
        </ul>

        <h3>Billing data (lenders)</h3>
        <ul>
          <li>Subscription status and Stripe customer identifiers (payment card data is handled
            by Stripe, not stored on our servers).</li>
        </ul>

        <h3>Technical data</h3>
        <ul>
          <li>Browser/device type, logs, and error diagnostics where collected for security and
            reliability.</li>
        </ul>
      </LegalSection>

      <LegalSection id="how-we-use" title="4. How we use personal information">
        <p>We process personal information to:</p>
        <ul>
          <li>Provide, maintain, and improve the Platform;</li>
          <li>Authenticate users and enforce tenant isolation between organisations;</li>
          <li>Facilitate connections, applications, loans, and repayment workflows;</li>
          <li>Send service emails (verification, password reset, invites, reminders) and optional
            SMS where configured;</li>
          <li>Process subscriptions and prevent fraud or abuse;</li>
          <li>Maintain audit trails required for accountability and dispute resolution;</li>
          <li>Comply with legal obligations and respond to lawful requests.</li>
        </ul>
      </LegalSection>

      <LegalSection id="legal-basis" title="5. Legal basis (POPIA)">
        <p>Depending on the context, we rely on one or more of the following:</p>
        <ul>
          <li>
            <strong>Contract</strong> — processing necessary to deliver the service you signed up
            for;
          </li>
          <li>
            <strong>Consent</strong> — where you opt in (e.g. marketing, optional SMS);
          </li>
          <li>
            <strong>Legitimate interest</strong> — security, fraud prevention, and service
            improvement, balanced against your rights;
          </li>
          <li>
            <strong>Legal obligation</strong> — where law requires retention or disclosure.
          </li>
        </ul>
        <p>
          Special personal information (such as ID numbers) is processed only where necessary for
          the lending workflow and with appropriate safeguards.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="6. Sharing and subprocessors">
        <p>
          We do not sell personal information. We share data only as needed to operate LMS, including
          with:
        </p>
        <ul>
          <li>
            <strong>Hosting and database</strong> — e.g. Supabase (Postgres and document storage);
          </li>
          <li>
            <strong>Application hosting</strong> — e.g. Vercel (web) and Render (API);
          </li>
          <li>
            <strong>Email</strong> — e.g. Brevo for transactional messages;
          </li>
          <li>
            <strong>Payments</strong> — Stripe for lender subscriptions;
          </li>
          <li>
            <strong>SMS</strong> — optional providers (e.g. Twilio, Africa&apos;s Talking) when
            enabled;
          </li>
          <li>
            <strong>Queue/cache</strong> — Redis for background jobs such as notifications.
          </li>
        </ul>
        <p>
          Lenders and borrowers connected through the Platform can see information necessary for
          their relationship (e.g. a lender sees a connected borrower&apos;s application and
          documents). We enforce access controls and row-level security to limit cross-tenant
          access.
        </p>
      </LegalSection>

      <LegalSection id="international" title="7. Cross-border transfers">
        <p>
          Some subprocessors may process data outside South Africa. Where required, we take steps
          reasonably necessary under POPIA for lawful cross-border flows, including contractual
          safeguards with providers.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="8. Retention">
        <p>
          We retain personal information for as long as your account is active and as needed to
          provide the service, resolve disputes, enforce agreements, and meet legal or audit
          requirements. Document and audit records may be kept for longer where lending laws or
          legitimate business needs require.
        </p>
        <p>
          When data is no longer required, we delete or anonymise it subject to backup cycles and
          legal holds.
        </p>
      </LegalSection>

      <LegalSection id="security" title="9. Security">
        <p>Measures include, among others:</p>
        <ul>
          <li>Encrypted transport (HTTPS), hashed passwords, and JWT-based authentication;</li>
          <li>Organisation-scoped access and PostgreSQL row-level security;</li>
          <li>Private document storage with time-limited signed URLs;</li>
          <li>Audit logging of significant actions on the Platform.</li>
        </ul>
        <p>
          No system is perfectly secure. Report suspected incidents to{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="10. Your rights">
        <p>Under POPIA, you may have the right to:</p>
        <ul>
          <li>Request access to personal information we hold about you;</li>
          <li>Request correction of inaccurate or incomplete information;</li>
          <li>Request deletion where processing is no longer lawful or necessary;</li>
          <li>Object to processing in certain circumstances;</li>
          <li>Withdraw consent where processing is consent-based;</li>
          <li>Lodge a complaint with the Information Regulator (South Africa).</li>
        </ul>
        <p>
          Submit requests to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. We may need
          to verify your identity. Some requests may be limited where we must retain data for legal
          or contractual reasons, or where a lender organisation is the responsible party for
          specific borrower records.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="11. Cookies and similar technologies">
        <p>
          We use essential cookies and local storage for authentication sessions (NextAuth). These
          are required for the Platform to function. We do not use third-party advertising cookies
          in the core product. If we add analytics later, we will update this Policy and, where
          required, obtain consent.
        </p>
      </LegalSection>

      <LegalSection id="children" title="12. Children">
        <p>
          LMS is not directed at persons under 18. We do not knowingly collect personal
          information from children. Contact us if you believe a minor has registered an account.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="13. Changes to this Policy">
        <p>
          We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date
          at the top will change, and material updates may be communicated by email or in-app
          notice.
        </p>
      </LegalSection>

      <LegalSection id="related" title="14. Related documents">
        <p>
          See also our <Link href="/legal/terms">Terms of Service</Link>, which describe acceptable
          use, platform limitations, and lender/borrower responsibilities.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="15. Contact">
        <p>
          Privacy and POPIA enquiries:{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
