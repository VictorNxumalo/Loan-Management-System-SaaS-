-- Wipe ALL LMS app data (users, orgs, loans, wallets, etc.) — keeps schema & migrations.
-- Run in Supabase SQL Editor, or: pnpm db:reset:staging (uses DIRECT_URL from .env)
--
-- ⚠️  DISPOSABLE ENVIRONMENTS ONLY — never run on production.
--
-- Storage files are NOT cleared here — Supabase blocks direct DELETE on storage.objects.
-- After this script, empty bucket "lms-documents" in Supabase → Storage (select all → delete),
-- or run: pnpm db:reset:staging (uses the Storage API for files).

TRUNCATE TABLE
  "notifications",
  "audit_logs",
  "documents",
  "user_kyc_documents",
  "payment_submissions",
  "wallet_transactions",
  "wallet_bank_accounts",
  "wallets",
  "loan_agreements",
  "loan_stitch_disbursements",
  "organisation_stitch_linkpay",
  "repayments",
  "repayment_schedules",
  "loans",
  "loan_applications",
  "borrowers",
  "subscriptions",
  "team_invites",
  "lender_invites",
  "borrower_lender_links",
  "borrower_accounts",
  "password_reset_tokens",
  "email_verification_tokens",
  "refresh_tokens",
  "users",
  "organisations"
RESTART IDENTITY CASCADE;
