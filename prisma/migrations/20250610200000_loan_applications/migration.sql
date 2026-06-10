-- Loan applications (Phase B2) + link platform borrowers to CRM records

CREATE TYPE "LoanApplicationStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

ALTER TABLE "borrowers" ADD COLUMN "platform_user_id" UUID;
CREATE INDEX "borrowers_org_id_platform_user_id_idx" ON "borrowers"("org_id", "platform_user_id");

CREATE TABLE "loan_applications" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "borrower_user_id" UUID NOT NULL,
    "borrower_id" UUID,
    "loan_id" UUID,
    "principal_cents" INTEGER NOT NULL,
    "interest_type" "InterestType" NOT NULL,
    "term_periods" INTEGER NOT NULL,
    "frequency" "RepaymentFrequency" NOT NULL,
    "start_date" DATE NOT NULL,
    "purpose" TEXT,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "lender_notes" TEXT,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loan_applications_loan_id_key" ON "loan_applications"("loan_id");
CREATE INDEX "loan_applications_org_id_status_idx" ON "loan_applications"("org_id", "status");
CREATE INDEX "loan_applications_borrower_user_id_idx" ON "loan_applications"("borrower_user_id");
CREATE INDEX "loan_applications_org_id_borrower_user_id_idx" ON "loan_applications"("org_id", "borrower_user_id");

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_borrower_user_id_fkey"
  FOREIGN KEY ("borrower_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_borrower_id_fkey"
  FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loan_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loan_applications" FORCE ROW LEVEL SECURITY;

CREATE POLICY "loan_applications_borrower_select" ON "loan_applications"
  FOR SELECT USING (borrower_user_id = app_current_user_id());

CREATE POLICY "loan_applications_borrower_insert" ON "loan_applications"
  FOR INSERT WITH CHECK (borrower_user_id = app_current_user_id());

CREATE POLICY "loan_applications_borrower_update" ON "loan_applications"
  FOR UPDATE USING (
    borrower_user_id = app_current_user_id()
    AND status = 'SUBMITTED'
  );

CREATE POLICY "loan_applications_org" ON "loan_applications"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());
