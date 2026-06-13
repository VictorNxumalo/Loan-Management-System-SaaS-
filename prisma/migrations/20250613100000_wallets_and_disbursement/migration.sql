-- Phase 1: Internal wallet ledger + loan disbursement tracking

CREATE TYPE "WalletOwnerType" AS ENUM ('ORGANISATION', 'BORROWER_USER');
CREATE TYPE "WalletTransactionType" AS ENUM ('TOP_UP', 'WITHDRAWAL', 'DISBURSEMENT', 'REPAYMENT', 'ADJUSTMENT', 'REVERSAL');
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "DisbursementStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'COMPLETED', 'FAILED');

ALTER TABLE "loans" ADD COLUMN "disbursement_status" "DisbursementStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "loans" ADD COLUMN "disbursed_at" TIMESTAMP(3);

CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "owner_type" "WalletOwnerType" NOT NULL,
    "owner_org_id" UUID,
    "owner_user_id" UUID,
    "available_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallets_owner_org_id_key" ON "wallets"("owner_org_id");
CREATE UNIQUE INDEX "wallets_owner_user_id_key" ON "wallets"("owner_user_id");
CREATE INDEX "wallets_owner_type_idx" ON "wallets"("owner_type");

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_owner_org_id_fkey"
  FOREIGN KEY ("owner_org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "wallet_bank_accounts" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "account_holder" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "branch_code" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallet_bank_accounts_wallet_id_key" ON "wallet_bank_accounts"("wallet_id");

ALTER TABLE "wallet_bank_accounts" ADD CONSTRAINT "wallet_bank_accounts_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "org_id" UUID,
    "type" "WalletTransactionType" NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "balance_after_cents" INTEGER,
    "loan_id" UUID,
    "payment_submission_id" UUID,
    "description" TEXT,
    "idempotency_key" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallet_transactions_idempotency_key_key" ON "wallet_transactions"("idempotency_key");
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");
CREATE INDEX "wallet_transactions_org_id_idx" ON "wallet_transactions"("org_id");
CREATE INDEX "wallet_transactions_loan_id_idx" ON "wallet_transactions"("loan_id");

ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallets" FORCE ROW LEVEL SECURITY;

ALTER TABLE "wallet_bank_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_bank_accounts" FORCE ROW LEVEL SECURITY;

ALTER TABLE "wallet_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_transactions" FORCE ROW LEVEL SECURITY;

-- Lender org wallets: scoped by owner_org_id
CREATE POLICY "wallets_org_tenant" ON "wallets"
  USING (
    owner_type = 'ORGANISATION'
    AND owner_org_id = app_current_org_id()
  )
  WITH CHECK (
    owner_type = 'ORGANISATION'
    AND owner_org_id = app_current_org_id()
  );

-- Borrower user wallets: scoped by owner_user_id
CREATE POLICY "wallets_borrower_select" ON "wallets"
  FOR SELECT USING (
    owner_type = 'BORROWER_USER'
    AND owner_user_id = app_current_user_id()
  );

CREATE POLICY "wallets_borrower_insert" ON "wallets"
  FOR INSERT WITH CHECK (
    owner_type = 'BORROWER_USER'
    AND owner_user_id = app_current_user_id()
  );

CREATE POLICY "wallets_borrower_update" ON "wallets"
  FOR UPDATE USING (
    owner_type = 'BORROWER_USER'
    AND owner_user_id = app_current_user_id()
  );

-- Lenders may read connected borrower wallets during disbursement (org context + linked borrower)
CREATE POLICY "wallets_lender_read_borrower" ON "wallets"
  FOR SELECT USING (
    owner_type = 'BORROWER_USER'
    AND EXISTS (
      SELECT 1 FROM "borrower_lender_links" bll
      WHERE bll.borrower_user_id = "wallets"."owner_user_id"
        AND bll.org_id = app_current_org_id()
    )
  );

CREATE POLICY "wallets_lender_insert_borrower" ON "wallets"
  FOR INSERT WITH CHECK (
    owner_type = 'BORROWER_USER'
    AND EXISTS (
      SELECT 1 FROM "borrower_lender_links" bll
      WHERE bll.borrower_user_id = "wallets"."owner_user_id"
        AND bll.org_id = app_current_org_id()
    )
  );

CREATE POLICY "wallets_lender_update_borrower" ON "wallets"
  FOR UPDATE USING (
    owner_type = 'BORROWER_USER'
    AND EXISTS (
      SELECT 1 FROM "borrower_lender_links" bll
      WHERE bll.borrower_user_id = "wallets"."owner_user_id"
        AND bll.org_id = app_current_org_id()
    )
  );

-- Bank accounts: via wallet ownership
CREATE POLICY "wallet_bank_accounts_org" ON "wallet_bank_accounts"
  USING (
    EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "wallet_bank_accounts"."wallet_id"
        AND w.owner_type = 'ORGANISATION'
        AND w.owner_org_id = app_current_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "wallet_bank_accounts"."wallet_id"
        AND w.owner_type = 'ORGANISATION'
        AND w.owner_org_id = app_current_org_id()
    )
  );

CREATE POLICY "wallet_bank_accounts_borrower" ON "wallet_bank_accounts"
  USING (
    EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "wallet_bank_accounts"."wallet_id"
        AND w.owner_type = 'BORROWER_USER'
        AND w.owner_user_id = app_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "wallet_bank_accounts"."wallet_id"
        AND w.owner_type = 'BORROWER_USER'
        AND w.owner_user_id = app_current_user_id()
    )
  );

-- Transactions: org-scoped or via wallet ownership
CREATE POLICY "wallet_transactions_org" ON "wallet_transactions"
  USING (
    org_id = app_current_org_id()
    OR EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "wallet_transactions"."wallet_id"
        AND w.owner_type = 'ORGANISATION'
        AND w.owner_org_id = app_current_org_id()
    )
  )
  WITH CHECK (
    org_id = app_current_org_id()
    OR EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "wallet_transactions"."wallet_id"
        AND w.owner_type = 'ORGANISATION'
        AND w.owner_org_id = app_current_org_id()
    )
  );

CREATE POLICY "wallet_transactions_borrower" ON "wallet_transactions"
  USING (
    EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "wallet_transactions"."wallet_id"
        AND w.owner_type = 'BORROWER_USER'
        AND w.owner_user_id = app_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "wallet_transactions"."wallet_id"
        AND w.owner_type = 'BORROWER_USER'
        AND w.owner_user_id = app_current_user_id()
    )
  );
