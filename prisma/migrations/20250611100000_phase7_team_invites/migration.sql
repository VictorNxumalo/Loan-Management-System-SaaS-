-- Phase 7: team member invites (lender staff) + RLS

CREATE TABLE "team_invites" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_invites_token_hash_key" ON "team_invites"("token_hash");
CREATE INDEX "team_invites_org_id_email_idx" ON "team_invites"("org_id", "email");

ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_user_id_fkey"
  FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_invites" FORCE ROW LEVEL SECURITY;

-- Org admins manage their own invites; token lookup allows the registration
-- flow (no org context yet) to read and accept an invite by token hash.
CREATE POLICY "team_invites_select" ON "team_invites"
  FOR SELECT USING (
    org_id = app_current_org_id()
    OR current_setting('app.token_lookup', true) = 'true'
  );

CREATE POLICY "team_invites_insert" ON "team_invites"
  FOR INSERT WITH CHECK (org_id = app_current_org_id());

CREATE POLICY "team_invites_update" ON "team_invites"
  FOR UPDATE USING (
    org_id = app_current_org_id()
    OR current_setting('app.token_lookup', true) = 'true'
  );
