-- Wipe all LMS app data (users, orgs, loans, applications, etc.) — keeps schema & migrations.
-- Run: pnpm db:reset:staging (uses DATABASE_URL / DIRECT_URL from .env)
-- Only use on disposable staging — NOT production.

TRUNCATE TABLE
  "notifications",
  "audit_logs",
  "documents",
  "payment_submissions",
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

-- Uploaded files in Supabase Storage (ignore error if role lacks storage access)
DELETE FROM storage.objects WHERE bucket_id = 'lms-documents';
