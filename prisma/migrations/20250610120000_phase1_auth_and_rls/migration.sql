-- Phase 1: Auth tables + user fields + Row Level Security

-- AlterTable: users — auth & onboarding fields
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateTable: refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: email_verification_tokens
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: password_reset_tokens
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Session variable: app.current_org_id (UUID string) set per request by the API.

ALTER TABLE "organisations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "borrowers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "repayment_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "repayments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "organisations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
ALTER TABLE "borrowers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "loans" FORCE ROW LEVEL SECURITY;
ALTER TABLE "repayment_schedules" FORCE ROW LEVEL SECURITY;
ALTER TABLE "repayments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;
ALTER TABLE "email_verification_tokens" FORCE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" FORCE ROW LEVEL SECURITY;

-- Helper: read current org id from session (NULL if unset)
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- organisations
CREATE POLICY "organisations_select" ON "organisations"
  FOR SELECT USING (id = app_current_org_id());

CREATE POLICY "organisations_insert" ON "organisations"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "organisations_update" ON "organisations"
  FOR UPDATE USING (id = app_current_org_id());

-- users
CREATE POLICY "users_select" ON "users"
  FOR SELECT USING (
    org_id = app_current_org_id()
    OR current_setting('app.auth_lookup', true) = 'true'
  );

CREATE POLICY "users_insert" ON "users"
  FOR INSERT WITH CHECK (org_id = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY "users_update" ON "users"
  FOR UPDATE USING (org_id = app_current_org_id());

-- borrowers
CREATE POLICY "borrowers_tenant" ON "borrowers"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());

-- loans
CREATE POLICY "loans_tenant" ON "loans"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());

-- repayment_schedules (scoped via loan)
CREATE POLICY "repayment_schedules_tenant" ON "repayment_schedules"
  USING (
    EXISTS (
      SELECT 1 FROM "loans"
      WHERE "loans"."id" = "repayment_schedules"."loan_id"
        AND "loans"."org_id" = app_current_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "loans"
      WHERE "loans"."id" = "repayment_schedules"."loan_id"
        AND "loans"."org_id" = app_current_org_id()
    )
  );

-- repayments
CREATE POLICY "repayments_tenant" ON "repayments"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());

-- documents
CREATE POLICY "documents_tenant" ON "documents"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());

-- audit_logs (insert-only at app layer; SELECT scoped to tenant)
CREATE POLICY "audit_logs_select" ON "audit_logs"
  FOR SELECT USING (org_id = app_current_org_id());

CREATE POLICY "audit_logs_insert" ON "audit_logs"
  FOR INSERT WITH CHECK (org_id = app_current_org_id());

-- notifications
CREATE POLICY "notifications_tenant" ON "notifications"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());

-- subscriptions
CREATE POLICY "subscriptions_tenant" ON "subscriptions"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());

-- auth token tables: scoped to current user (with lookup mode for refresh/verify flows)
CREATE POLICY "refresh_tokens_user" ON "refresh_tokens"
  USING (
    user_id = app_current_user_id()
    OR current_setting('app.token_lookup', true) = 'true'
  )
  WITH CHECK (user_id = app_current_user_id());

CREATE POLICY "refresh_tokens_update" ON "refresh_tokens"
  FOR UPDATE USING (
    user_id = app_current_user_id()
    OR current_setting('app.token_lookup', true) = 'true'
  );

CREATE POLICY "email_verification_tokens_user" ON "email_verification_tokens"
  USING (
    user_id = app_current_user_id()
    OR current_setting('app.token_lookup', true) = 'true'
  )
  WITH CHECK (user_id = app_current_user_id());

CREATE POLICY "email_verification_tokens_update" ON "email_verification_tokens"
  FOR UPDATE USING (
    user_id = app_current_user_id()
    OR current_setting('app.token_lookup', true) = 'true'
  );

CREATE POLICY "password_reset_tokens_user" ON "password_reset_tokens"
  USING (
    user_id = app_current_user_id()
    OR current_setting('app.token_lookup', true) = 'true'
  )
  WITH CHECK (user_id = app_current_user_id());

CREATE POLICY "password_reset_tokens_update" ON "password_reset_tokens"
  FOR UPDATE USING (
    user_id = app_current_user_id()
    OR current_setting('app.token_lookup', true) = 'true'
  );

-- Prevent UPDATE/DELETE on immutable audit_logs
CREATE POLICY "audit_logs_no_update" ON "audit_logs" FOR UPDATE USING (false);
CREATE POLICY "audit_logs_no_delete" ON "audit_logs" FOR DELETE USING (false);

-- Prevent UPDATE/DELETE on immutable repayments
CREATE POLICY "repayments_no_update" ON "repayments" FOR UPDATE USING (false);
CREATE POLICY "repayments_no_delete" ON "repayments" FOR DELETE USING (false);
