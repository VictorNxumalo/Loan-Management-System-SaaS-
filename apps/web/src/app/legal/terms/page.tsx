import Link from 'next/link';
import { LegalSection, LegalPageShell } from '@/components/legal/legal-page-shell';
import {
  getLegalContactEmail,
  getLegalOperatorName,
  LEGAL_LAST_UPDATED,
  PRODUCT_FULL_NAME,
} from '@/lib/legal-config';

export const metadata = {
  title: 'Terms of Service · LMS',
  description: `Terms of Service for the ${PRODUCT_FULL_NAME} platform.`,
};

export default function TermsPage() {
  const operator = getLegalOperatorName();
  const contactEmail = getLegalContactEmail();

  return (
    <LegalPageShell
      active="terms"
      title="Terms of Service"
      description={`Last updated: ${LEGAL_LAST_UPDATED}. Please read these terms before using the platform.`}
    >
      <LegalSection id="introduction" title="1. Introduction">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern access to and use of the{' '}
          {PRODUCT_FULL_NAME} platform (&quot;LMS&quot;, &quot;Platform&quot;, &quot;we&quot;,
          &quot;us&quot;, or &quot;our&quot;) operated by <strong>{operator}</strong>.
        </p>
        <p>
          By creating an account or using the Platform, you agree to these Terms and our{' '}
          <Link href="/legal/privacy">Privacy Policy</Link>. If you do not agree, do not use
          the Platform.
        </p>
      </LegalSection>

      <LegalSection id="what-lms-is" title="2. What LMS is (and is not)">
        <p>
          LMS is <strong>software-as-a-service</strong> that helps lenders and borrowers
          manage lending relationships: connections, applications, documents, loan schedules,
          repayments, and payment proof submissions.
        </p>
        <p>
          <strong>LMS is not a credit provider, bank, or financial adviser.</strong> We do not
          originate loans, decide creditworthiness, hold client funds, or process loan
          repayments on your behalf. Lenders and borrowers enter into lending arrangements
          directly with each other; LMS provides administrative tools only.
        </p>
        <p>
          Nothing on the Platform constitutes legal, tax, accounting, or regulatory advice.
          Lenders remain solely responsible for compliance with applicable laws, including (where
          relevant) the National Credit Act 34 of 2005 (&quot;NCA&quot;) and registration or
          exemption requirements.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Accounts and eligibility">
        <ul>
          <li>
            You must be at least <strong>18 years old</strong> and capable of entering into a
            binding contract.
          </li>
          <li>
            You must provide accurate registration information and keep your credentials
            confidential. You are responsible for activity under your account.
          </li>
          <li>
            <strong>Lender accounts</strong> represent a lending organisation (workspace). Team
            members act on behalf of that organisation.
          </li>
          <li>
            <strong>Borrower accounts</strong> are personal. You may connect with one or more
            lender organisations through invites or the public marketplace, subject to platform
            rules.
          </li>
          <li>
            We may suspend or terminate accounts that violate these Terms or pose a security or
            legal risk.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="lender-responsibilities" title="4. Lender responsibilities">
        <p>If you use LMS as a lender, you agree that you (not LMS) are responsible for:</p>
        <ul>
          <li>Determining whether you may lawfully lend and on what terms;</li>
          <li>Conducting affordability and credit assessments required by law;</li>
          <li>Preparing compliant loan agreements and disclosures;</li>
          <li>Accurate recording of loans, repayments, and balances in the Platform;</li>
          <li>Reviewing borrower documents and payment proofs before approving transactions;</li>
          <li>Handling disputes, collections, and borrower communications outside the scope of
            LMS support.</li>
        </ul>
      </LegalSection>

      <LegalSection id="borrower-responsibilities" title="5. Borrower responsibilities">
        <p>If you use LMS as a borrower, you agree to:</p>
        <ul>
          <li>Provide truthful information in applications and uploads;</li>
          <li>Submit only documents you are authorised to share;</li>
          <li>Honour repayment obligations agreed with your lender outside the Platform;</li>
          <li>Use payment proof submissions honestly — false or misleading proofs may result in
            account suspension and referral to your lender or authorities.</li>
        </ul>
      </LegalSection>

      <LegalSection id="acceptable-use" title="6. Acceptable use">
        <p>You must not:</p>
        <ul>
          <li>Use the Platform for unlawful, fraudulent, or abusive purposes;</li>
          <li>Attempt to bypass security, access another tenant&apos;s data, or probe systems;</li>
          <li>Upload malware, offensive content, or material you do not have rights to use;</li>
          <li>Scrape, resell, or reverse engineer the Platform except where law permits;</li>
          <li>Use LMS to facilitate unregistered credit provision where registration is required.</li>
        </ul>
      </LegalSection>

      <LegalSection id="documents-payments" title="7. Documents, storage, and payment proofs">
        <p>
          The Platform allows upload of application documents and proof-of-payment files. Files
          are stored using third-party infrastructure (see our Privacy Policy). You grant us a
          limited licence to store, process, and display uploads solely to operate the service.
        </p>
        <p>
          <strong>Payment proof workflow:</strong> borrowers may submit proof that they paid a
          lender (e.g. EFT). Lenders manually review and approve or reject submissions. LMS
          updates loan balances based on lender actions — we do not verify bank transactions with
          financial institutions.
        </p>
      </LegalSection>

      <LegalSection id="subscriptions" title="8. Subscriptions and billing (lenders)">
        <p>
          Lender workspaces may be offered on subscription plans with free trials. Paid plans are
          processed by <strong>Stripe</strong> (or another payment processor we designate). By
          subscribing, you also agree to the processor&apos;s terms.
        </p>
        <ul>
          <li>Fees, plan limits, and trial periods are shown in the billing area of the Platform;</li>
          <li>Failed payment or expired trials may place a workspace in read-only mode;</li>
          <li>Refunds are handled according to our published billing policy unless law requires
            otherwise.</li>
        </ul>
      </LegalSection>

      <LegalSection id="availability" title="9. Service availability">
        <p>
          We aim for reliable uptime but do not guarantee uninterrupted access. Maintenance,
          third-party outages, or force majeure may cause downtime. Scheduled jobs (e.g. overdue
          detection, repayment reminders) depend on infrastructure remaining available.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="10. Intellectual property">
        <p>
          LMS, its branding, and underlying software remain our property or our licensors&apos;.
          You retain ownership of content you upload. You receive a limited, non-exclusive licence
          to use the Platform during your subscription or account term, subject to these Terms.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="11. Disclaimers">
        <p>
          The Platform is provided <strong>&quot;as is&quot;</strong> and{' '}
          <strong>&quot;as available&quot;</strong> to the fullest extent permitted by law. We
          disclaim warranties of merchantability, fitness for a particular purpose, and
          non-infringement. We do not warrant that calculations, schedules, or balances are
          error-free — lenders should verify critical figures before relying on them.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="12. Limitation of liability">
        <p>
          To the maximum extent permitted by South African law, {operator} and its directors,
          employees, and suppliers will not be liable for indirect, incidental, special, or
          consequential damages, or for loss of profits, data, or goodwill, arising from your use
          of LMS.
        </p>
        <p>
          Our total aggregate liability for claims relating to the Platform in any twelve-month
          period is limited to the greater of (a) amounts you paid us for the service in that
          period, or (b) ZAR 1,000, except where liability cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection id="indemnity" title="13. Indemnity">
        <p>
          You agree to indemnify and hold harmless {operator} against claims, losses, and expenses
          (including reasonable legal fees) arising from your use of the Platform, your lending or
          borrowing activities, content you upload, or your breach of these Terms or applicable
          law.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="14. Termination">
        <p>
          You may stop using the Platform at any time. We may suspend or terminate access for
          breach, non-payment, or legal requirement. On termination, your right to use the
          Platform ends. Provisions that by nature should survive (liability limits, indemnity,
          governing law) will survive.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="15. Changes to these Terms">
        <p>
          We may update these Terms from time to time. We will post the revised version on this
          page and update the &quot;Last updated&quot; date. Material changes may be notified by
          email or in-app notice. Continued use after changes take effect constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection id="law" title="16. Governing law and disputes">
        <p>
          These Terms are governed by the laws of the <strong>Republic of South Africa</strong>.
          You agree to the jurisdiction of South African courts, subject to any mandatory
          consumer protections that apply to you.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="17. Contact">
        <p>
          Questions about these Terms:{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
