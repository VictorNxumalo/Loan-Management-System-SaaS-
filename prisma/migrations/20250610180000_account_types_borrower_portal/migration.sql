-- Account types, borrower portal, marketplace links

CREATE TYPE "AccountType" AS ENUM ('LENDER', 'BORROWER');
CREATE TYPE "BorrowerLinkSource" AS ENUM ('INVITE', 'PUBLIC');

ALTER TABLE "users" ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'LENDER';
ALTER TABLE "users" ALTER COLUMN "org_id" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

DROP INDEX IF EXISTS "users_org_id_email_key";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "borrower_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "id_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "borrower_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "borrower_accounts_user_id_key" ON "borrower_accounts"("user_id");

CREATE TABLE "borrower_lender_links" (
    "id" UUID NOT NULL,
    "borrower_user_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "source" "BorrowerLinkSource" NOT NULL DEFAULT 'INVITE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "borrower_lender_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "borrower_lender_links_borrower_user_id_org_id_key"
  ON "borrower_lender_links"("borrower_user_id", "org_id");
CREATE INDEX "borrower_lender_links_borrower_user_id_idx" ON "borrower_lender_links"("borrower_user_id");
CREATE INDEX "borrower_lender_links_org_id_idx" ON "borrower_lender_links"("org_id");

CREATE TABLE "lender_invites" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lender_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lender_invites_token_hash_key" ON "lender_invites"("token_hash");
CREATE INDEX "lender_invites_org_id_email_idx" ON "lender_invites"("org_id", "email");

ALTER TABLE "borrower_accounts" ADD CONSTRAINT "borrower_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "borrower_lender_links" ADD CONSTRAINT "borrower_lender_links_borrower_user_id_fkey"
  FOREIGN KEY ("borrower_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "borrower_lender_links" ADD CONSTRAINT "borrower_lender_links_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lender_invites" ADD CONSTRAINT "lender_invites_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Public marketplace: orgs with publicListing visible without tenant context
DROP POLICY IF EXISTS "organisations_select" ON "organisations";
CREATE POLICY "organisations_select" ON "organisations"
  FOR SELECT USING (
    id = app_current_org_id()
    OR COALESCE((settings->>'publicListing')::boolean, false) = true
  );

ALTER TABLE "borrower_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "borrower_lender_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lender_invites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "borrower_accounts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "borrower_lender_links" FORCE ROW LEVEL SECURITY;
ALTER TABLE "lender_invites" FORCE ROW LEVEL SECURITY;

CREATE POLICY "borrower_accounts_self" ON "borrower_accounts"
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

CREATE POLICY "borrower_lender_links_borrower" ON "borrower_lender_links"
  USING (borrower_user_id = app_current_user_id())
  WITH CHECK (borrower_user_id = app_current_user_id());

CREATE POLICY "lender_invites_org" ON "lender_invites"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());

CREATE POLICY "lender_invites_token_lookup" ON "lender_invites"
  FOR SELECT USING (
    org_id = app_current_org_id()
    OR current_setting('app.token_lookup', true) = 'true'
  );
