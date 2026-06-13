-- Stitch disbursement tracking + LinkPay lender authorization (phase 2)

ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'STITCH';

CREATE TYPE "StitchDisbursementStatus" AS ENUM (
  'PENDING',
  'SUBMITTED',
  'COMPLETED',
  'ERROR',
  'PAUSED',
  'CANCELLED',
  'REVERSED'
);

CREATE TABLE "loan_stitch_disbursements" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "stitch_disbursement_id" TEXT,
    "nonce" TEXT NOT NULL,
    "external_reference" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" "StitchDisbursementStatus" NOT NULL DEFAULT 'PENDING',
    "status_reason" TEXT,
    "beneficiary_name" TEXT NOT NULL,
    "beneficiary_account_number" TEXT NOT NULL,
    "beneficiary_bank_id" TEXT NOT NULL,
    "beneficiary_reference" TEXT NOT NULL,
    "disbursement_type" TEXT NOT NULL DEFAULT 'default',
    "last_webhook_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_stitch_disbursements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loan_stitch_disbursements_loan_id_key" ON "loan_stitch_disbursements"("loan_id");
CREATE UNIQUE INDEX "loan_stitch_disbursements_stitch_disbursement_id_key" ON "loan_stitch_disbursements"("stitch_disbursement_id");
CREATE UNIQUE INDEX "loan_stitch_disbursements_nonce_key" ON "loan_stitch_disbursements"("nonce");
CREATE UNIQUE INDEX "loan_stitch_disbursements_external_reference_key" ON "loan_stitch_disbursements"("external_reference");
CREATE INDEX "loan_stitch_disbursements_org_id_idx" ON "loan_stitch_disbursements"("org_id");
CREATE INDEX "loan_stitch_disbursements_status_idx" ON "loan_stitch_disbursements"("status");

ALTER TABLE "loan_stitch_disbursements" ADD CONSTRAINT "loan_stitch_disbursements_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_stitch_disbursements" ADD CONSTRAINT "loan_stitch_disbursements_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "organisation_stitch_linkpay" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token" TEXT,
    "access_expires_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_stitch_linkpay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organisation_stitch_linkpay_org_id_key" ON "organisation_stitch_linkpay"("org_id");

ALTER TABLE "organisation_stitch_linkpay" ADD CONSTRAINT "organisation_stitch_linkpay_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
